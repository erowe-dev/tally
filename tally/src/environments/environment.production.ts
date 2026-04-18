export const environment = {
  production: true,
  auth0: {
    domain: 'dev-2iqdjh6lgnv6pnz5.us.auth0.com',
    clientId: 'gowY6jnkLVTalCdvhymKOYfHl8DFjiYd',
    authorizationParams: {
      redirect_uri: 'https://tally-theta-two.vercel.app',
      audience: 'https://api.tally.app',
    },
  },
  apiUrl: 'TODO_YOUR_RENDER_API_URL', // e.g. 'https://tally-api.onrender.com'
};
