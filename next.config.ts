import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Add empty turbopack config to silence the warning in dev mode
  // Turbopack is used for dev, webpack is still used for production builds
  turbopack: {},
  
  // Webpack config for production builds (where debugger statements are removed)
  webpack: (config, { dev }) => {
    // Remove debugger statements in production builds
    if (!dev) {
      // Add a custom plugin to strip debugger statements
      config.plugins = config.plugins || [];
      config.plugins.push({
        apply: (compiler: any) => {
          compiler.hooks.compilation.tap('StripDebuggerPlugin', (compilation: any) => {
            compilation.hooks.processAssets.tap(
              {
                name: 'StripDebuggerPlugin',
                stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
              },
              (assets: any) => {
                Object.keys(assets).forEach((filename) => {
                  if (filename.endsWith('.js')) {
                    const asset = assets[filename];
                    const source = asset.source();
                    // Remove all debugger statements
                    const newSource = source.replace(/debugger\s*;?/g, '');
                    if (newSource !== source) {
                      assets[filename] = {
                        ...asset,
                        source: () => newSource,
                      };
                    }
                  }
                });
              }
            );
          });
        },
      });
    }
    
    return config;
  },
};

export default nextConfig;
