import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react';
import { useCookies } from 'react-cookie';
import { Container, Row, Col, Card, InputGroup, FormControl, Button} from 'react-bootstrap';
import {
    authMethodOAuthClientGet,
    authApiRequest,
    authApiErrorCode, authApiGetErrorMessageFromCode 
} from '@kirillzhosul/florgon-auth-api';

export default function Home({ query }) {
  return (<>
    <div className="mt-5">
        <Authentication query={query}/>
    </div>
  </>)
}

export function getServerSideProps({ query }) {
    if (query.client_id || query.redirect_uri){
        return {
            props: { query },
        }
    }
  
    return {
        redirect: {
            destination: 'https://florgon.space/profile',
            permanent: false,
        },
    }
}

function Authentication({query}){
    /// @description Authentication component with API requests.

    // Usings.
    const [cookies, setCookie] = useCookies([process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_NAME])
    // States.
    const [apiError, setApiError] = useState(undefined);
    const [error, setError] = useState(undefined);

    const [user, setUser] = useState(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [redirectTo, setRedirectTo] = useState("/")
    const [signMethod, setSignMethod] = useState("signin");

    const [signFormError, setSignFormError] = useState(undefined);
    const [signFormLogin, setSignFormLogin] = useState("");
    const [signFormUsername, setSignFormUsername] = useState("");
    const [signFormEmail, setSignFormEmail] = useState("");
    const [signFormPassword, setSignFormPassword] = useState("");
    const [signFormPasswordConfirmation, setSignFormPasswordConfirmation] = useState("");
    const [signFormTfaOtp, setSignFormTfaOtp] = useState("");
    const [signFormOtpRequested, setSignFormOtpRequested] = useState(false);

    const [oauthRequestedPermissions, setOauthRequestedPermissions] = useState([])
    const [oauthClientData] = useState({
        displayName: undefined,
        displayAvatar: undefined,

        redirectUri: query["redirect_uri"] || undefined,
        clientId: query["client_id"] || undefined,

        responseType: query["response_type"] || undefined,

        state: query["state"] || undefined,
        scope: query["scope"] || undefined,
        
        isVerified: undefined
    })

    const applySessionToken = useCallback((sessionToken) =>{
        setCookie(process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
            "domain": process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_DOMAIN,
            "maxAge": parseInt(process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_MAX_AGE),
            "path": "/"
        });
    }, [setCookie]);

    const getSessionToken = useCallback(() => {
        return cookies[process.env.NEXT_PUBLIC_SESSION_TOKEN_COOKIE_NAME];
    }, [cookies])

    const onAllowAccess = useCallback(() => {
        // Request params.
        const clientId = oauthClientData.clientId;
        const sessionToken = getSessionToken();
        const state = oauthClientData.state;
        const redirectUri = oauthClientData.redirectUri;
        const scope = oauthClientData.scope;
        const responseType = oauthClientData.responseType;

        // Building request.
        const requestParams = `client_id=${clientId}&session_token=${sessionToken}&state=${state}&redirect_uri=${redirectUri}&scope=${scope}&response_type=${responseType}`
        setIsLoading(true);
        authApiRequest("_oauth._allowClient", requestParams).then((response) => {
            setRedirectTo(response["success"]["redirect_to"]);
            window.location.href = response["success"]["redirect_to"];
            setIsRedirecting(true);
            setIsLoading(false)
        }).catch((error) => {
            setIsLoading(false);
            if (error && "error" in error) return setApiError(error["error"]);
            setError("Failed to allow access for client, due to unexpected error!")
        });
    }, [getSessionToken, oauthClientData, setIsLoading, setError, setApiError, setRedirectTo, setIsRedirecting]);

    const onDisallowAccess = useCallback(() => {
        switch(oauthClientData.responseType){
            case "token":
                window.location.href = `${ oauthClientData.redirectUri}#error=user-rejected-access&state=${oauthClientData.state}`;
            break;
            case "code":
                window.location.href = `${ oauthClientData.redirectUri}?error=user-rejected-access&state=${oauthClientData.state}`;
            break;
        }
    }, [oauthClientData]);

    const fetchUser = useCallback(() => {
        const sessionToken = getSessionToken();
        if (sessionToken){
            setIsLoading(true);
            
            authApiRequest("_session._getUserInfo", `session_token=${sessionToken}`).then((response) => {
                setUser(response["success"]["user"]);
                setIsLoading(false);
                setSignMethod("accept");
            }).catch((error) => {
                setIsLoading(false);
                if (error && "error" in error){
                    const errorCode = error["error"]["code"];
                    if (errorCode === authApiErrorCode.AUTH_INVALID_TOKEN || errorCode === authApiErrorCode.AUTH_EXPIRED_TOKEN || errorCode === authApiErrorCode.AUTH_REQUIRED){
                        return;
                    }
            
                    setApiError(error["error"]);
                }
            })
        }
    }, [setApiError, setIsLoading, setUser, getSessionToken]);

    const onSignin = useCallback(() => {
        if (signFormLogin === "") return setSignFormError("Please enter login!");
        if (signFormPassword === "") return setSignFormError("Please enter password!");
        if (signFormPassword.length <= 5) return setSignFormError("Password too short!");
        if (signFormPassword.length <= 4) return setSignFormError("Username too short!");

        setSignFormError(undefined);
        setIsLoading(true);

        let params = `login=${signFormLogin}&password=${signFormPassword}`
        if (signFormOtpRequested){
            params += `&tfa_otp=${signFormTfaOtp}`
        }
        authApiRequest("_session._signin", params).then((response) => {
            applySessionToken(response["success"]["session_token"]);
            fetchUser();
        }).catch((error) => {
            setIsLoading(false);
            if (error && "error" in error){
                const errorCode = error["error"]["code"];
                if (errorCode === authApiErrorCode.AUTH_INVALID_CREDENTIALS){
                    return setSignFormError("Invalid credentials to authenticate (Password or login)!");
                }
                if (errorCode === authApiErrorCode.AUTH_TFA_OTP_REQUIRED){
                    // We are should send 2FA OTP code.

                    // Requesting 2FA code send.
                    setIsLoading(true);

                    authApiRequest("_session._requestTfaOtp", `login=${signFormLogin}&password=${signFormPassword}`).then((response) => {
                        // Request 2FA OTP send.
                        const tfa_device_type = response.success?.tfa_device;
                        setIsLoading(false);
                        setSignFormTfaOtp("")
                        setSignFormOtpRequested(true);
                        setSignFormError(`Please enter code from ${tfa_device_type} to sign-in!`);
                    }).catch((error) => {
                        setIsLoading(false);
                        if (error && "error" in error){
                            const errorCode = error["error"]["code"];
                            return setSignFormError("Failed to request 2FA code because of error: " + authApiGetErrorMessageFromCode(errorCode));
                        }
                        setSignFormError("Failed to request 2FA code because of unexpected error!");
                        console.error(error)
                    })
                }
                return setSignFormError("Failed to sign-in because of error: " + authApiGetErrorMessageFromCode(errorCode));
            }
            setSignFormError("Failed to sign-in because of unexpected error!");
            console.error(error)
        })
    }, [applySessionToken, setSignFormError, setIsLoading, signFormLogin, signFormPassword, fetchUser, setSignFormTfaOtp, setSignFormOtpRequested, signFormOtpRequested, signFormTfaOtp]);

    const onSignup = useCallback(() => {
        if (signFormUsername === "") return setSignFormError("Please enter username!");
        if (signFormPassword === "") return setSignFormError("Please enter password!");
        if (signFormEmail === "") return setSignFormError("Please enter E-mail!");
        if (signFormPassword.length <= 5) return setSignFormError("Password too short!");
        if (signFormUsername.length <= 4) return setSignFormError("Username too short!");
        if (signFormPassword !== signFormPasswordConfirmation) return setSignFormError("Passwords not same!");

        setSignFormError(undefined);
        setIsLoading(true);

        authApiRequest("_session._signup", `username=${signFormUsername}&email=${signFormEmail}&password=${signFormPassword}`).then((response) => {
            applySessionToken(response["success"]["session_token"]);
            fetchUser();
        }).catch((error) => {
            setIsLoading(false);
            if (error && "error" in error){
                const errorCode = error["error"]["code"];
                if (errorCode === authApiErrorCode.AUTH_EMAIL_TAKEN){
                    return setSignFormError("Given E-mail is already taken!");
                }
                if (errorCode === authApiErrorCode.AUTH_USERNAME_TAKEN){
                    return setSignFormError("Given username is already taken!");
                }
                if (errorCode === authApiErrorCode.AUTH_USERNAME_INVALID){
                    return setSignFormError("Invalid username (Should be lowercase alphabet letters only)!");
                }
                if (errorCode === authApiErrorCode.AUTH_EMAIL_INVALID){
                    return setSignFormError("Invalid E-mail!");
                }
                return setSignFormError("Failed to sign-up because of error: " + authApiGetErrorMessageFromCode(errorCode));
            }
            setSignFormError("Failed to sign-up because of unexpected error!");
        })
    }, [applySessionToken, setSignFormError, setIsLoading, signFormPassword, signFormPasswordConfirmation, signFormUsername, signFormEmail, fetchUser]);

    useEffect(() => {
        if (oauthClientData.responseType !== "code" && oauthClientData.responseType !== "token"){
            return setError("Unknown response_type, should be one of these: `code`, `token`");
        }

        if (oauthClientData.redirectUri === undefined){
            return setError("Invalid redirect_uri! redirect_uri not given.");
        }

        if (
            !(oauthClientData.redirectUri.startsWith("http://")) &&
            !(oauthClientData.redirectUri.startsWith("https://"))){
            oauthClientData.redirectUri = `http://${oauthClientData.redirectUri}`;
        }
        try{new URL(oauthClientData.redirectUri)}catch{
            return setError("Invalid redirect_uri! Redirect uri should contain VALID URL.");
        }

        if (oauthClientData.scope){
            let permissions = undefined;
            if (oauthClientData.scope.includes("*")){
                permissions = ["edit", "sessions", "habits", "noexpire", "oauth_clients", "email", "admin", "gatey", "notes", "ads", "cc", "security"];
            }else{
                permissions = oauthClientData.scope.split(",");
            }
            setOauthRequestedPermissions(permissions);
        }
        
        setIsLoading(true);
        authMethodOAuthClientGet(oauthClientData.clientId).then((response) => {
            setIsLoading(false);

            oauthClientData.displayAvatar = response["success"]["oauth_client"]["display"]["avatar"];
            oauthClientData.displayName = response["success"]["oauth_client"]["display"]["name"];
            oauthClientData.isVerified = response["success"]["oauth_client"]["states"]["is_verified"];

            fetchUser();
        }).catch((error) => {
            setIsLoading(false);
            console.error(error)
            if (error && "error" in error) return setApiError(error["error"]);
            setError("Failed to fetch OAuth client because of unexpected error!")
        })
    }, [setIsLoading, setApiError, setError, cookies, oauthClientData, fetchUser]);

    // Handle error messages.
    if (apiError) return (<div className="display-5 text-danger">
        <div className="display-6 text-black">{authApiGetErrorMessageFromCode(apiError["code"])} (Code {apiError["code"]})</div> {apiError["message"]}
    </div>);
    if (error) return (<div className="display-5 text-danger">
        {error}
    </div>);

    /// Other messages.
    if (isLoading) return <div>Loading...</div>;
    if (isRedirecting) return <>
    <h3>You are being redirected to authorized application...</h3>
    <small>If your browser does not redirects you, please click <a href={redirectTo}>here</a></small>
    </>
    const redirectUriDomain = (oauthClientData.redirectUri) ? new URL(oauthClientData.redirectUri).hostname : undefined
    return (<div>
        <Container className="w-75 mb-3">
            {signMethod === "accept" && <Card className="shadow-sm mx-auto">
                <Card.Body>
                    <Card.Title as="h2">
                        {oauthClientData.displayAvatar && <div><img src={oauthClientData.displayAvatar} alt="Display avatar"/></div>}
                        <b>{oauthClientData.displayName}</b> requests access to your <b>Florgon</b> account.<br/>
                        {!oauthClientData.isVerified && <span className="text-danger">(Application not verified by Florgon)</span>}
                        {oauthClientData.isVerified && <span className="text-success">(Application verified by Florgon)</span>}
                        <br/>
                    </Card.Title>
                    <Card.Text>
                        <hr/>
                        <p>
                            <i>Application will have access to:</i><br/>
                            <div>- <b className="text-primary">Account information {oauthRequestedPermissions.includes("email") ? "(Including E-mail)" :"(Not including E-mail)" }</b></div>
                            
                            {oauthRequestedPermissions.map((oauthRequestedPermission) => {
                                switch(oauthRequestedPermission){
                                    case "edit":
                                         return (<div>- <b className="text-primary">Editing account information</b></div>)
                                    case "email":
                                        return (<div>- <b className="text-primary">Account E-mail address</b></div>)
                                    case "noexpire":
                                        return (<div>- <b className="text-primary">Access at every time, from another clients</b></div>)
                                    case "gatey":
                                        return (<div>- <b className="text-primary">Access to Gatey API</b></div>)
                                    case "ads":
                                        return (<div>- <b className="text-primary">Access to Ads API</b></div>)
                                    case "cc":
                                        return (<div>- <b className="text-primary">Access to CC API</b></div>)
                                    case "sessions":
                                        return (<div>- <b className="text-primary">Sessions audit log</b></div>)
                                    case "admin":
                                        if (!(user?.states?.is_admin)){
                                            break;
                                        }
                                        return (<div>- <b className="text-primary">Administrator terminal</b></div>)
                                    case "habits":
                                        return (<div>- <b className="text-primary">Access to Habits API</b></div>)
                                    case "notes":
                                        return (<div>- <b className="text-primary">Access to Notes API</b></div>)
                                    case "oauth_clients":
                                        return (<div>- <b className="text-primary">OAuth clients (Including destructive actions)</b></div>)
                                    case "security":
                                        return (<div>- <b className="text-primary">Security (2FA, Password recovery)</b></div>)
                            }})}
                        </p>
                        <hr/>
                        <small>Authorizing will redirect to <b><a disabled>{redirectUriDomain}</a></b>.</small><br/>
                        {user !== undefined && <small>Signed in as <b>{user["username"]}</b>. <Link href="/logout">Logout?</Link></small>}
                        <Row>
                            <Col><Button variant="secondary" size="lg" className="shadow-sm text-nowrap mb-1" onClick={onDisallowAccess}>Cancel</Button></Col>
                            <Col><Button variant="success" size="lg" className="shadow-sm text-nowrap" onClick={onAllowAccess}>Allow access</Button></Col>
                        </Row>
                    </Card.Text>
                </Card.Body>
            </Card>}
            {signMethod === "signin" && <Card className="shadow-sm mx-auto">
                <Card.Body>
                    <Card.Title as="h2">Sign in to <b>Florgon</b> to continue.</Card.Title>
                    <Card.Text>
                    <span className="mb-3 mt-3">Login using your credentials.</span>
                    </Card.Text>
                    {signFormError && (<p className="text-danger">{signFormError}</p>)}
                    <InputGroup className="mb-2 shadow-sm">
                        <div className="input-group-prepend">
                            <span className="input-group-text">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-person" viewBox="0 0 16 16">
                                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                            </svg>
                            </span>
                        </div>
                        <FormControl placeholder="Username or E-mail" aria-label="Username or E-mail" type="text" value={signFormLogin} onChange={(e) => {setSignFormLogin(e.target.value)}}/>
                    </InputGroup>
                    <InputGroup className={`${signFormOtpRequested ? "mb-2" : "mb-4"} shadow-sm`}>
                        <div className="input-group-prepend">
                            <span className="input-group-text">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16">
                                    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                                    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                                </svg>
                            </span>
                        </div>
                        <FormControl placeholder="Password" aria-label="Password" type="password" value={signFormPassword} onChange={(e) => {setSignFormPassword(e.target.value)}}/>
                    </InputGroup>
                    {signFormOtpRequested && <InputGroup className="mb-4 shadow-sm">
                        <div className="input-group-prepend">
                            <span className="input-group-text">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-shield-lock" viewBox="0 0 16 16">
                                    <path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z"/>
                                    <path d="M9.5 6.5a1.5 1.5 0 0 1-1 1.415l.385 1.99a.5.5 0 0 1-.491.595h-.788a.5.5 0 0 1-.49-.595l.384-1.99a1.5 1.5 0 1 1 2-1.415z"/>
                                </svg>
                            </span>
                        </div>
                        <FormControl placeholder="OTP code" aria-label="OTP code" type="text" value={signFormTfaOtp} 
                            onChange={(e) => {
                                let newValue = e.target.value;
                                newValue = newValue.toString().replace(/[^0-9]/g, "").replace("e", "");
                                if (newValue.length <= 6){
                                    if (newValue.length == 0 ){
                                        setSignFormTfaOtp("");
                                    }else{
                                        newValue = parseInt(newValue);
                                        setSignFormTfaOtp(newValue);
                                    }
                                }
                            }}
                        />
                    </InputGroup>}
                    <Button variant="primary" size="lg" className="shadow-sm text-nowrap" onClick={onSignin}>Sign in!</Button>
                    <Row>
                        <Col><Button variant="outline-secondary" size="sm" className="shadow-sm text-nowrap mb-1" disabled>Forgot password?</Button></Col>
                        <Col><Button variant="outline-secondary" size="sm" className="shadow-sm text-nowrap mb-1" onClick={() => setSignMethod("signup")}>No account yet?</Button></Col>
                    </Row>
                </Card.Body>
            </Card>}
            {signMethod === "signup" && <Card className="shadow-sm">
                <Card.Body>
                    <Card.Title as="h2">Sign up on <b>Florgon</b> to continue.</Card.Title>
                    <Card.Text>
                    <span className="mb-3 mt-3">Create new Florgon account.</span>
                    </Card.Text>

                    {signFormError && (<p className="text-danger">{signFormError}</p>)}
                    <InputGroup className="mb-2 shadow-sm">
                        <div className="input-group-prepend">
                            <span className="input-group-text">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-person" viewBox="0 0 16 16">
                                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                            </svg>
                            </span>
                        </div>
                        <FormControl placeholder="Username" aria-label="Username" type="text" value={signFormUsername} onChange={(e) => {setSignFormUsername(e.target.value)}}/>
                    </InputGroup>
                    <InputGroup className="mb-2 shadow-sm">
                        <div className="input-group-prepend">
                            <span className="input-group-text">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-envelope" viewBox="0 0 16 16">
                                    <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/>
                                </svg>
                            </span>
                        </div>
                        <FormControl placeholder="E-mail" aria-label="E-mail" type="email" value={signFormEmail} onChange={(e) => {setSignFormEmail(e.target.value)}}/>
                    </InputGroup>
                    <InputGroup className="mb-4 shadow-sm">
                        <div className="input-group-prepend">
                            <span className="input-group-text">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16">
                                    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                                    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                                </svg>
                            </span>
                        </div>
                        <FormControl placeholder="Password" aria-label="Password" type="password" value={signFormPassword} onChange={(e) => {setSignFormPassword(e.target.value)}}/>
                        <FormControl placeholder="Password confirmation" aria-label="Password confirmation" type="password" value={signFormPasswordConfirmation} onChange={(e) => {setSignFormPasswordConfirmation(e.target.value)}}/>
                    </InputGroup>
                    <Button variant="primary" size="lg" className="shadow-sm text-nowrap mb-1" onClick={onSignup}>Sign up!</Button>
                    <Row>
                        <Col><Button size="sm" variant="outline-secondary" className="shadow-sm text-nowrap" onClick={() => setSignMethod("signin")}>Already have account?</Button></Col>
                    </Row>
                    <small><div><Link href="https://florgon.space/legal/privacy-policy">By continue, you accepting our Privacy policy</Link></div></small>
                </Card.Body>
            </Card>}
        </Container>
    </div>);
}