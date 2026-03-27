module.exports = {
  apps: [
    {
      name: "ai-meeting-backend",
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}