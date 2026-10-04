"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Megaphone } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type SponsoredCampaign = {
  campaign_id: string;
  sponsor_name: string;
  title: string;
  description: string;
  destination_url: string;
  image_url: string | null;
  format: "banner" | "native" | "sponsor";
};

const supabase = createClient();

export default function SponsoredAd({ slotKey, placement, comicId }: { slotKey: string; placement: "home" | "comic" | "reader"; comicId?: string }) {
  const [campaign, setCampaign] = useState<SponsoredCampaign | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc("get_active_sponsor_campaign", {
        p_slot_key: slotKey,
        p_comic_id: comicId || null,
      });
      if (error) {
        const details = {
          slotKey,
          comicId: comicId ?? null,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        };
        if (error.code === "PGRST202") {
          console.error("Ads database function is outdated or its schema cache has not refreshed. Rerun supabase/ads-management.sql in Supabase SQL Editor.", details);
        } else {
          console.error("Unable to load sponsored campaign:", details);
        }
        return;
      }
      const row = Array.isArray(data) ? data[0] : null;
      if (!cancelled && row && typeof row === "object"
        && typeof row.campaign_id === "string"
        && typeof row.sponsor_name === "string"
        && typeof row.title === "string"
        && typeof row.destination_url === "string"
        && ["banner", "native", "sponsor"].includes(row.format)) {
        setCampaign({
          campaign_id: row.campaign_id,
          sponsor_name: row.sponsor_name,
          title: row.title,
          description: typeof row.description === "string" ? row.description : "",
          destination_url: row.destination_url,
          image_url: typeof row.image_url === "string" ? row.image_url : null,
          format: row.format,
        });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [comicId, slotKey]);

  if (!campaign) return null;
  const sponsorLabel = campaign.format === "sponsor" ? "Sponsor" : "Iklan";

  return (
    <aside className={`reader-sponsored-ad reader-sponsored-ad-${placement}`} aria-label={`${sponsorLabel}: ${campaign.sponsor_name}`}>
      <div className="reader-sponsored-ad-label"><Megaphone size={13} /> {sponsorLabel}</div>
      <a className="reader-sponsored-ad-link" href={campaign.destination_url} target="_blank" rel="noreferrer noopener sponsored">
        {campaign.image_url && <Image className="reader-sponsored-ad-image" src={campaign.image_url} alt="" width={1200} height={600} unoptimized loading="lazy" />}
        <span className="reader-sponsored-ad-copy">
          <span className="reader-sponsored-ad-sponsor">{campaign.sponsor_name}</span>
          <strong>{campaign.title}</strong>
          {campaign.description && <span className="reader-sponsored-ad-description">{campaign.description}</span>}
          <span className="reader-sponsored-ad-cta">Kunjungi <ExternalLink size={14} /></span>
        </span>
      </a>
    </aside>
  );
}
