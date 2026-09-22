import { jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import { MockPaymentGatewayProvider } from "./mock-payment-gateway.provider.js";

function fakeConfig(overrides: Record<string, number> = {}): ConfigService {
  const values: Record<string, number> = {
    MOCK_PAYMENT_SETTLEMENT_LAG_MS: 50,
    MOCK_PAYMENT_LINKED_ACCOUNT_ACTIVATION_DELAY_MS: 0,
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe("MockPaymentGatewayProvider", () => {
  it("activates a linked account instantly when activation delay is 0", async () => {
    const provider = new MockPaymentGatewayProvider(fakeConfig());
    const { linkedAccountId, status } = await provider.createLinkedAccount({
      farmerProfileId: "farmer-1",
      fullName: "Test Farmer",
      phoneE164: "+919812345678",
      kyc: {},
    });
    expect(status).toBe("ACTIVE");
    expect(await provider.getLinkedAccountStatus(linkedAccountId)).toBe(
      "ACTIVE",
    );
  });

  it("holds a linked account PENDING until the configured activation delay elapses", async () => {
    jest.useFakeTimers();
    const provider = new MockPaymentGatewayProvider(
      fakeConfig({ MOCK_PAYMENT_LINKED_ACCOUNT_ACTIVATION_DELAY_MS: 1000 }),
    );
    const { linkedAccountId, status } = await provider.createLinkedAccount({
      farmerProfileId: "farmer-1",
      fullName: "Test Farmer",
      phoneE164: "+919812345678",
      kyc: {},
    });
    expect(status).toBe("PENDING");

    jest.advanceTimersByTime(999);
    expect(await provider.getLinkedAccountStatus(linkedAccountId)).toBe(
      "PENDING",
    );

    jest.advanceTimersByTime(2);
    expect(await provider.getLinkedAccountStatus(linkedAccountId)).toBe(
      "ACTIVE",
    );
    jest.useRealTimers();
  });

  it("keeps a transfer ON_HOLD until released, then RELEASED, then SETTLED after the settlement lag", async () => {
    jest.useFakeTimers();
    const provider = new MockPaymentGatewayProvider(
      fakeConfig({ MOCK_PAYMENT_SETTLEMENT_LAG_MS: 5000 }),
    );
    const holdCeiling = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45); // 45 days out — realistic default
    const { clientPayload } = await provider.createSplitPayment({
      orderId: "order-1",
      totalAmount: 1000,
      payoutAmount: 900,
      currency: "INR",
      farmerLinkedAccountId: "mock_la_x",
      holdCeiling,
    });
    const { providerTransferId } = clientPayload as {
      providerTransferId: string;
    };

    expect(provider.getTransferSnapshot(providerTransferId).status).toBe(
      "ON_HOLD",
    );

    const released = await provider.releaseTransfer(providerTransferId);
    // toTransferResult maps internal SETTLED back to RELEASED too, but we haven't settled yet here.
    expect(released.status).toBe("RELEASED");
    expect(provider.getTransferSnapshot(providerTransferId).status).toBe(
      "RELEASED",
    );

    // Not yet settled just after release — this is exactly the "released but not yet settled" window
    // docs/order-state-machine.md calls out as the higher-risk dispute case.
    jest.advanceTimersByTime(4999);
    expect(provider.getTransferSnapshot(providerTransferId).status).toBe(
      "RELEASED",
    );

    jest.advanceTimersByTime(2);
    expect(provider.getTransferSnapshot(providerTransferId).status).toBe(
      "SETTLED",
    );
    expect(
      provider.getTransferSnapshot(providerTransferId).settledAt,
    ).toBeInstanceOf(Date);
    jest.useRealTimers();
  });

  it("auto-releases at the hold ceiling if nobody released it first, mirroring Cashfree's 45-day cap", async () => {
    const provider = new MockPaymentGatewayProvider(fakeConfig());
    const almostNow = new Date(Date.now() + 10); // ceiling 10ms in the future
    const { clientPayload } = await provider.createSplitPayment({
      orderId: "order-2",
      totalAmount: 1000,
      payoutAmount: 900,
      currency: "INR",
      farmerLinkedAccountId: "mock_la_x",
      holdCeiling: almostNow,
    });
    const { providerTransferId } = clientPayload as {
      providerTransferId: string;
    };

    await new Promise((resolve) => setTimeout(resolve, 20));

    // Nobody called releaseTransfer — reading the snapshot should show the ceiling forced a release.
    expect(provider.getTransferSnapshot(providerTransferId).status).toBe(
      "RELEASED",
    );
  });

  it("lets reduce/reverse be forced to fail on demand, for testing the escalated-dispute path", async () => {
    const provider = new MockPaymentGatewayProvider(fakeConfig());
    const holdCeiling = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45);
    const { clientPayload } = await provider.createSplitPayment({
      orderId: "order-3",
      totalAmount: 1000,
      payoutAmount: 900,
      currency: "INR",
      farmerLinkedAccountId: "mock_la_x",
      holdCeiling,
    });
    const { providerTransferId } = clientPayload as {
      providerTransferId: string;
    };

    provider.simulateReverseFailure(providerTransferId);
    const result = await provider.reverseTransfer(providerTransferId);
    expect(result.status).toBe("FAILED");

    // The failure was a one-shot simulation — a subsequent call succeeds normally.
    const retried = await provider.reverseTransfer(providerTransferId);
    expect(retried.status).toBe("REVERSED");
  });
});
