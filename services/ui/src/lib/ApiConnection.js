import React from 'react';
import getConfig from 'next/config';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import { WebSocketLink } from 'apollo-link-ws';
import { onError } from 'apollo-link-error';
import { ApolloLink } from 'apollo-link';
import { getMainDefinition } from 'apollo-utilities';
import { ApolloProvider } from 'react-apollo';
import { AuthContext } from './withAuth';
import NotAuthenticated from '../components/NotAuthenticated';

const { serverRuntimeConfig, publicRuntimeConfig } = getConfig();

const ApiConnection = ({ children }) =>
  <AuthContext.Consumer>
    {auth => {
      if (!auth.authenticated) {
        return <NotAuthenticated />;
      }

      const httpLink = new HttpLink({
        uri: publicRuntimeConfig.GRAPHQL_API,
        headers: {
          authorization: `Bearer ${auth.apiToken}`,
        },
      })

      const wsLink = new WebSocketLink({
        uri: publicRuntimeConfig.GRAPHQL_API.replace(/https/, 'wss').replace(/http/, 'ws'),
        options: {
          reconnect: true,
          connectionParams: {
              authToken: auth.apiToken,
          },
        },
      });

      const requestLink = ApolloLink.split(
        ({ query }) => {
          const { kind, operation } = getMainDefinition(query);
          return kind === 'OperationDefinition' && operation === 'subscription';
        },
        wsLink,
        httpLink
      );

      const client = new ApolloClient({
        link: ApolloLink.from([
          onError(({ graphQLErrors, networkError }) => {
            if (graphQLErrors)
              graphQLErrors.map(({ message, locations, path }) =>
                console.log(
                  `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
                ),
              );
            if (networkError) console.log(`[Network error]: ${networkError}`);
          }),
          requestLink
        ]),
        cache: new InMemoryCache()
      });

      return (
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
      );
    }}
  </AuthContext.Consumer>;

export default ApiConnection;
