import { useState } from "react";
import { Button } from "../assistant/ai-chat/button";
import FileOrganizer from "../..";
import { Notice } from "obsidian";
import { validateApiKey } from "../../apiUtils";

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
      const response = await fetch(`${plugin.getServerUrl()}/api/top-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plugin.settings.API_KEY}`,
        },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
      onLicenseKeyChange(data.licenseKey);
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
        onClick={() => handleTopUp("standard")}
        disabled={loadingTier !== null}
        className="w-full"
      >
        {loadingTier === "standard"
          ? "Processing..."
          : "Top up 5M credits ($15)"}
      </Button>
      <Button
        onClick={() => handleTopUp("large")}
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
