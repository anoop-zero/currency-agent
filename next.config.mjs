/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the submission tree minimal: no auto-generated AGENTS.md / CLAUDE.md.
  agentRules: false,
  // Keeps the dev overlay badge out of the submission screenshot.
  devIndicators: false,
};

export default nextConfig;
