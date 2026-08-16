import { useEffect, useState } from "react";
import {
  CAMPAIGN_BADGES,
  readCampaignBadgeConfig,
  writeCampaignBadgeConfig,
} from "./CampaignBadgeStrip.jsx";

export default function CampaignBadgeQuickControls() {
  const [config, setConfig] = useState(readCampaignBadgeConfig);

  useEffect(() => {
    const sync = (event) => setConfig(event?.detail || readCampaignBadgeConfig());
    window.addEventListener("plotflow-campaign-badges-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("plotflow-campaign-badges-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function toggle(id) {
    const next = {
      ...config,
      badges: config.badges.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      ),
    };
    setConfig(next);
    writeCampaignBadgeConfig(next);
  }

  const ordered = [...config.badges].sort((a, b) => a.order - b.order);

  return (
    <div className="dock-campaign-tabs">
      <div className="dock-campaign-heading">
        <span>CAMPAIGN TABS</span>
        <small>Quick show / hide</small>
      </div>
      <div className="dock-campaign-buttons">
        {ordered.map((item) => {
          const asset = CAMPAIGN_BADGES.find((badge) => badge.id === item.id);
          if (!asset) return null;
          return (
            <button
              key={item.id}
              type="button"
              className={item.enabled ? "active" : ""}
              onClick={() => toggle(item.id)}
              title={asset.name}
            >
              {asset.name}
            </button>
          );
        })}
      </div>
      <small className="dock-campaign-note">Scale, gap và thứ tự: chỉnh trong Edit Layout.</small>
    </div>
  );
}
