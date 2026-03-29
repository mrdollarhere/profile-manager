module.exports = {
  apps: [
    {
      name: "browser-manager",
      script: "server.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        DB_PATH: "profiles.db"
      }
    }
  ]
};
