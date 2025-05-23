module.exports = {
  apps: [
    {
      name: 'fb-rent-account',
      script: '/var/www/fb-rent-account/dist/index.js',
      interpreter: '/root/.nvm/versions/node/v20.16.0/bin/node', // Đảm bảo sử dụng đúng Node.js từ NVM
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_file: '/var/www/fb-rent-account/.env',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
