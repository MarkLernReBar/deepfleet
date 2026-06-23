import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import * as db from "./db";

type OAuthState = {
  userId: number;
  agentId: number;
  provider: "gmail" | "slack";
};

function baseUrl(req: Request): string {
  if (ENV.appBaseUrl) return ENV.appBaseUrl.replace(/\/$/, "");
  const host = req.get("host") ?? "localhost:3000";
  const proto = req.protocol;
  return `${proto}://${host}`;
}

async function signState(payload: OAuthState): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret || "dev-secret");
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(secret);
}

async function verifyState(token: string): Promise<OAuthState | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    const userId = Number(payload.userId);
    const agentId = Number(payload.agentId);
    const provider = payload.provider as OAuthState["provider"];
    if (!userId || !agentId || (provider !== "gmail" && provider !== "slack")) return null;
    return { userId, agentId, provider };
  } catch {
    return null;
  }
}

function maskSecret(value: string): string {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

async function storeOAuthCredential(
  userId: number,
  provider: string,
  name: string,
  tokens: Record<string, unknown>
) {
  const secretValue = JSON.stringify(tokens);
  return db.createCredential({
    name,
    provider,
    kind: "oauth",
    scope: "shared",
    secretMasked: maskSecret(secretValue),
    secretValue,
    ownerId: userId,
  });
}

async function linkChannelCredential(agentId: number, provider: "gmail" | "slack", credentialId: number) {
  const channelType = provider === "gmail" ? "gmail" : "slack";
  await db.upsertAgentChannel({
    agentId,
    type: channelType,
    enabled: true,
    config: { credentialId },
  });
}

export function registerIntegrationRoutes(app: Express) {
  app.get("/api/integrations/status", (_req, res) => {
    res.json({
      google: Boolean(ENV.googleClientId && ENV.googleClientSecret),
      slack: Boolean(ENV.slackClientId && ENV.slackClientSecret),
    });
  });

  app.get("/api/integrations/google/start", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Sign in required" });
      return;
    }
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      res.status(503).json({ error: "Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET)" });
      return;
    }
    const agentId = Number(req.query.agentId);
    if (!agentId) {
      res.status(400).json({ error: "agentId required" });
      return;
    }
    const state = await signState({ userId: user.id, agentId, provider: "gmail" });
    const redirectUri = `${baseUrl(req)}/api/integrations/google/callback`;
    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" ");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", ENV.googleClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    res.redirect(302, url.toString());
  });

  app.get("/api/integrations/google/callback", async (req: Request, res: Response) => {
    const code = String(req.query.code ?? "");
    const stateRaw = String(req.query.state ?? "");
    const parsed = await verifyState(stateRaw);
    if (!code || !parsed) {
      res.status(400).send("Invalid OAuth state");
      return;
    }
    const redirectUri = `${baseUrl(req)}/api/integrations/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      res.status(502).send("Google token exchange failed");
      return;
    }
    const tokens = (await tokenRes.json()) as Record<string, unknown>;
    const cred = await storeOAuthCredential(parsed.userId, "gmail", "Gmail (connected)", tokens);
    if (cred) await linkChannelCredential(parsed.agentId, "gmail", cred.id);
    res.redirect(302, `/agents/${parsed.agentId}?tab=channels`);
  });

  app.get("/api/integrations/slack/start", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Sign in required" });
      return;
    }
    if (!ENV.slackClientId || !ENV.slackClientSecret) {
      res.status(503).json({ error: "Slack OAuth not configured (SLACK_CLIENT_ID/SECRET)" });
      return;
    }
    const agentId = Number(req.query.agentId);
    if (!agentId) {
      res.status(400).json({ error: "agentId required" });
      return;
    }
    const state = await signState({ userId: user.id, agentId, provider: "slack" });
    const redirectUri = `${baseUrl(req)}/api/integrations/slack/callback`;
    const scopes = "channels:read,chat:write,users:read";
    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", ENV.slackClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("state", state);
    res.redirect(302, url.toString());
  });

  app.get("/api/integrations/slack/callback", async (req: Request, res: Response) => {
    const code = String(req.query.code ?? "");
    const stateRaw = String(req.query.state ?? "");
    const parsed = await verifyState(stateRaw);
    if (!code || !parsed) {
      res.status(400).send("Invalid OAuth state");
      return;
    }
    const redirectUri = `${baseUrl(req)}/api/integrations/slack/callback`;
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ENV.slackClientId,
        client_secret: ENV.slackClientSecret,
        redirect_uri: redirectUri,
      }),
    });
    const tokens = (await tokenRes.json()) as Record<string, unknown>;
    if (!tokenRes.ok || tokens.ok === false) {
      res.status(502).send("Slack token exchange failed");
      return;
    }
    const cred = await storeOAuthCredential(parsed.userId, "slack", "Slack (connected)", tokens);
    if (cred) await linkChannelCredential(parsed.agentId, "slack", cred.id);
    res.redirect(302, `/agents/${parsed.agentId}?tab=channels`);
  });
}
