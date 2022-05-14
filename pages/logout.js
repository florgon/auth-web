import { useEffect } from 'react';
import { useCookies } from 'react-cookie';
import Head from 'next/head'

export default function Logout() {
    // Usings.
    const [,,removeCookie] = useCookies([process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_NAME])

    useEffect(() => {
        removeCookie(process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_NAME, {
            "domain": process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_DOMAIN,
            "maxAge": process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_MAX_AGE,
            "path": "/"
        });
        window.location.replace("/");
    }, [removeCookie])

    return (<>
        <Head>
            <meta name="title" content="Logout" />
            <title>Logout</title>
        </Head>
        <div className="display-1 text-danger"><b>Logging out...</b></div>
            <div className="row mt-5 mb-5">
                <div className="col-lg ml-lg-5 text-center">
                <p>Please wait...</p>
            </div>
        </div>
    </>)
}