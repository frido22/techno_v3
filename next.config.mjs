/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@strudel/web', '@strudel/core', '@strudel/mini', '@strudel/webaudio'],
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
};

export default nextConfig;
