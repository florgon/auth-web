import { useEffect } from 'react';
import { useCookies } from 'react-cookie';
import Head from 'next/head'
import { authApiRequest } from '@kirillzhosul/florgon-auth-api';

export function getServerSideProps({ query }) {
    return {
        props: { 
            revoke_all: (query.revoke_all !== undefined)
        },
    }
}

export default function Logout({ revoke_all }) {
    // Usings.
    const [cookies,,removeCookie] = useCookies([process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_NAME])

    useEffect(() => {
        function logoutBrowser(){
            removeCookie(process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_NAME, {
                "domain": process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_DOMAIN,
                "maxAge": process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_MAX_AGE,
                "path": "/"
            });
            window.location.replace("/");
        }
        
        function sendLogoutRequest(){
            const sessionToken = cookies[process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_NAME];
            return authApiRequest("_session._logout", `revoke_all=${revoke_all}&session_token=${sessionToken}`);
        }

        sendLogoutRequest().then(logoutBrowser).catch(logoutBrowser);

    }, [removeCookie])

    return (<>
        <Head>
            <meta name="title" content="Logout" />
            <title>Logout</title>
        </Head>
        <h3>You are being logouted...</h3>
        <small>Please wait, logging you out{revoke_all && " of all devices"}...</small>
    </>)
}