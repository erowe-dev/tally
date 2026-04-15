export const environment = {
  production: false,
  auth0: {
    domain: 'TODO_YOUR_AUTH0_DOMAIN', // e.g. 'your-tenant.us.auth0.com'
    clientId: 'TODO_YOUR_AUTH0_CLIENT_ID',
    authorizationParams: {
      redirect_uri: 'http://localhost:4200',
      audience: 'https://api.tally.app',
    },
  },
  apiUrl: 'http://localhost:3000',
};
