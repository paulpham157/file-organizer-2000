import { useState } from "react";
import { Button } from "../assistant/ai-chat/button";
import FileOrganizer from "../..";
import { Notice } from "obsidian";
import { validateApiKey } from "../../apiUtils";
import { obsidianFetch } from "../../lib/obsidian-fetch";
import { readResponseJson } from "../../lib/api-json";

type TopUpCreditsResponse = {
  url?: string;
  licenseKey?: string;
};

type TopUpTier = "standard" | "large";

export function TopUpCredits({
  plugin,
  onLicenseKeyChange,
}: {
  plugin: FileOrganizer;
  onLicenseKeyChange: (licenseKey: string) => void;
}) {
  const [loadingTier, setLoadingTier] = useState<TopUpTier | null>(null);

  const handleTopUp = async (tier: TopUpTier) => {
    // Validate API key before making request
    const validation = validateApiKey(plugin.settings.API_KEY);
    if (!validation.isValid) {
      new Notice(validation.error || "Invalid API key", 5000);
      return;
    }

    // Warn if key seems too short but still allow attempt
    if (validation.error) {
      console.warn("API key validation warning:", validation.error);
    }

    try {
      setLoadingTier(tier);
      const response = await obsidianFetch(`${plugin.getServerUrl()}/api/top-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plugin.settings.API_KEY}`,
        },
        body: JSON.stringify({ tier }),
      });

      const data = await readResponseJson<TopUpCreditsResponse>(response);
      if (data.url) {
        window.location.href = data.url;
      }
      if (data.licenseKey) {
        onLicenseKeyChange(data.licenseKey);
      }
    } catch (error) {
      console.error("Top-up error:", error);
      new Notice("Failed to process top-up request", 5000);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={() => { void handleTopUp("standard"); }}
        disabled={loadingTier !== null}
        className="w-full"
      >
        {loadingTier === "standard"
          ? "Processing..."
          : "Top up 5M credits ($15)"}
      </Button>
      <Button
        onClick={() => { void handleTopUp("large"); }}
        disabled={loadingTier !== null}
        className="w-full"
      >
        {loadingTier === "large"
          ? "Processing..."
          : "Top up 12M credits ($30) — better value"}
      </Button>
    </div>
  );
}
