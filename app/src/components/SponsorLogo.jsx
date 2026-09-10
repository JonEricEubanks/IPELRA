/**
 * SponsorLogo.jsx — the single logo tile used everywhere a sponsor logo appears.
 *
 * Always renders the logo on a light neutral background so dark/colored
 * vendor logos never blend into navy or tier-colored surrounding chrome.
 * Falls back to `fallback` when there is no logoUrl or the image fails to load.
 */

import { useState } from 'react';

export default function SponsorLogo({
  sponsor,
  size = 48,
  radius = 14,
  imgPadding = 6,
  border,
  boxShadow,
  fallbackBg,
  fallback,
}) {
  const [failed, setFailed] = useState(false);
  const hasLogo = Boolean(sponsor?.logoUrl) && !failed;
  // logoBg is set manually in Cosmos: "dark" for white-lettered logos, otherwise light
  const logoBg = sponsor?.logoBg === 'dark' ? 'var(--color-primary-dark)' : 'var(--color-surface-low)';

  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: radius,
        background: hasLogo ? logoBg : fallbackBg,
        border,
        boxShadow,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {hasLogo ? (
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: imgPadding }}
          onError={() => setFailed(true)}
        />
      ) : fallback}
    </div>
  );
}
