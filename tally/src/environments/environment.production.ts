export const environment = {
  production: true,
  auth0: {
    domain: 'TODO_YOUR_AUTH0_DOMAIN', // e.g. 'your-tenant.us.auth0.com'
    clientId: 'TODO_YOUR_AUTH0_CLIENT_ID',
    authorizationParams: {
      redirect_uri: 'https://tally-theta-two.vercel.app',
      audience: 'https://api.tally.app',
    },
  },
  apiUrl: 'TODO_YOUR_RENDER_API_URL', // e.g. 'https://tally-api.onrender.com'
};
