import User from "../models/User.js";

const publicUser = (user) => ({
  _id: user._id, email: user.email, name: user.name,
  emailVerified: user.emailVerified, avatarUrl: user.avatarUrl,
  plan: user.plan,
  lastLoginAt: user.lastLoginAt, lastLoginDevice: user.lastLoginDevice,
});

// Allow the mock endpoints only outside production. In production, the plan is
// set EXCLUSIVELY by the verified RevenueCat webhook below — never by the client.
const mockAllowed = () => process.env.NODE_ENV !== "production";

// POST /api/billing/mock-upgrade  (DEV ONLY)
// Lets you test the premium UX without real store purchases.
export const mockUpgrade = async (req, res) => {
  if (!mockAllowed()) return res.status(403).json({ success: false, message: "Not available" });
  req.user.plan = "premium";
  await req.user.save();
  return res.status(200).json({ success: true, user: publicUser(req.user) });
};

// POST /api/billing/mock-downgrade  (DEV ONLY)
export const mockDowngrade = async (req, res) => {
  if (!mockAllowed()) return res.status(403).json({ success: false, message: "Not available" });
  req.user.plan = "free";
  await req.user.save();
  return res.status(200).json({ success: true, user: publicUser(req.user) });
};

// POST /api/billing/revenuecat-webhook  (PRODUCTION path — no auth middleware)
// RevenueCat calls this when a subscription starts/renews/expires.
// SECURITY: verify the Authorization header against a shared secret you set in
// the RevenueCat dashboard (REVENUECAT_WEBHOOK_SECRET). RevenueCat also sends
// the app_user_id you assigned at purchase time — map it to your User._id.
export const revenueCatWebhook = async (req, res) => {
  try {
    const provided = (req.headers.authorization || "").replace("Bearer ", "");
    if (!process.env.REVENUECAT_WEBHOOK_SECRET || provided !== process.env.REVENUECAT_WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: "Bad signature" });
    }

    const event = req.body?.event;
    if (!event) return res.status(400).json({ success: false, message: "No event" });

    // You set app_user_id = String(user._id) when configuring Purchases on the client.
    const userId = event.app_user_id;
    const type = event.type; // INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, ...

    const activeTypes = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"];
    const inactiveTypes = ["EXPIRATION", "CANCELLATION", "BILLING_ISSUE"];

    const plan = activeTypes.includes(type) ? "premium"
      : inactiveTypes.includes(type) ? "free"
      : null;

    if (plan && userId) {
      await User.findByIdAndUpdate(userId, { plan });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[revenueCatWebhook] failed:", err);
    return res.status(500).json({ success: false });
  }
};
