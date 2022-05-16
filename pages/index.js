import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react';
import { useCookies } from 'react-cookie';
import { Container, Row, Col, Card, InputGroup, FormControl, Button} from 'react-bootstrap';
import { 
    _authMethodSessionGetUserInfo, _authMethodSessionSignin, _authMethodSessionSignup, authMethodOAuthClientGet,
    _authMethodOAuthAllowClient,
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
            destination: 'https://profile.florgon.space',
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

    const [signMethod, setSignMethod] = useState("signin");

    const [signFormError, setSignFormError] = useState(undefined);
    const [signFormLogin, setSignFormLogin] = useState("");
    const [signFormUsername, setSignFormUsername] = useState("");
    const [signFormEmail, setSignFormEmail] = useState("");
    const [signFormPassword, setSignFormPassword] = useState("");
    const [signFormPasswordConfirmation, setSignFormPasswordConfirmation] = useState("");

    const [oauthRequestedPermissions, setOauthRequestedPermissions] = useState([])
    const [oauthClientData] = useState({
        displayName: undefined,
        displayAvatar: undefined,

        redirectUri: query["redirect_uri"] || undefined,
        clientId: query["client_id"] || undefined,

        responseType: query["response_type"] || undefined,

        state: query["state"] || undefined,
        scope: query["scope"] || undefined
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
        const oauthAllowClientParams = [getSessionToken(), oauthClientData.clientId, oauthClientData.state, oauthClientData.redirectUri, oauthClientData.scope, oauthClientData.responseType]
        setIsLoading(true);
        _authMethodOAuthAllowClient(...oauthAllowClientParams).then((response) => {
            window.location.href = response["success"]["redirect_to"];
        }).catch((error) => {
            setIsLoading(false);
            if (error && "error" in error) return setApiError(error["error"]);
            setError("Failed to allow access for client, due to unexpected error!")
        });
    }, [getSessionToken, oauthClientData, setIsLoading, setError, setApiError]);

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
            _authMethodSessionGetUserInfo(sessionToken).then((response) => {
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
        if (signFormLogin === "") return setSignFormError("Please enter username or email!");
        if (signFormPassword === "") return setSignFormError("Please enter password!");
        if (signFormPassword.length <= 5) return setSignFormError("Password too short!");

        setSignFormError(undefined);
        setIsLoading(true);
        _authMethodSessionSignin(signFormLogin, signFormPassword).then((response) => {
            applySessionToken(response["success"]["session_token"]);
            fetchUser();
        }).catch((error) => {
            setIsLoading(false);
            if (error && "error" in error){
                const errorCode = error["error"]["code"];
                if (errorCode === authApiErrorCode.AUTH_INVALID_CREDENTIALS){
                    return setSignFormError("Invalid credentials to authenticate (Password or login)!");
                }
                return setSignFormError("Failed to sign-in because of error: " + authApiGetErrorMessageFromCode(errorCode));
            }
            setSignFormError("Failed to sign-in because of unexpected error!");
            console.error(error)
        })
    }, [applySessionToken, setSignFormError, setIsLoading, signFormLogin, signFormPassword, fetchUser]);

    const onSignup = useCallback(() => {
        if (signFormUsername === "") return setSignFormError("Please enter username!");
        if (signFormPassword === "") return setSignFormError("Please enter password!");
        if (signFormEmail === "") return setSignFormError("Please enter email!");
        if (signFormPassword.length <= 5) return setSignFormError("Password too short!");
        if (signFormUsername.length <= 4) return setSignFormError("Username too short!");
        if (signFormPassword !== signFormPasswordConfirmation) return setSignFormError("Passwords not same!");

        setSignFormError(undefined);
        setIsLoading(true);

        _authMethodSessionSignup(signFormUsername, signFormEmail, signFormPassword).then((_, response) => {
            applySessionToken(response["success"]["session_token"]);
            fetchUser();
        }).catch((error) => {
            setIsLoading(false);
            if (error && "error" in error){
                const errorCode = error["error"]["code"];
                if (errorCode === authApiErrorCode.AUTH_EMAIL_TAKEN){
                    return setSignFormError("Given email is already taken!");
                }
                if (errorCode === authApiErrorCode.AUTH_USERNAME_TAKEN){
                    return setSignFormError("Given username is already taken!");
                }
                if (errorCode === authApiErrorCode.AUTH_USERNAME_INVALID){
                    return setSignFormError("Invalid username (Should be lowercase alphabet letters only)!");
                }
                if (errorCode === authApiErrorCode.AUTH_EMAIL_INVALID){
                    return setSignFormError("Invalid email!");
                }
                return setSignFormError("Failed to sign-in because of error: " + authApiGetErrorMessageFromCode(errorCode));
            }
            setSignFormError("Failed to sign-in because of unexpected error!");
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

        setOauthRequestedPermissions(oauthClientData.scope.split(","))
        setIsLoading(true);
        authMethodOAuthClientGet(oauthClientData.clientId).then((response) => {
            setIsLoading(false);

            oauthClientData.displayAvatar = response["success"]["oauth_client"]["display"]["avatar"];
            oauthClientData.displayName = response["success"]["oauth_client"]["display"]["name"];

            fetchUser();
        }).catch((error) => {
            setIsLoading(false);
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

    const redirectUriDomain = (oauthClientData.redirectUri) ? new URL(oauthClientData.redirectUri).hostname : undefined
    return (<div>
        <Container>
            <Card className="mb-5 shadow-sm mx-auto">
            <Card.Body>
                <Card.Title as="h2">
                    {oauthClientData.displayAvatar && <div><img src={oauthClientData.displayAvatar} alt="Display avatar"/></div>}
                    <b>{oauthClientData.displayName}</b> requests access to your <b>Florgon</b> account.
                </Card.Title>
                <Card.Text>
                    <hr/>
                    <p>
                        <i>Application will have access to:</i>
                        <br/>
                        <div>- <b className="text-primary">Account information (Including email)</b></div>
                        {oauthRequestedPermissions.map((oauthRequestedPermission) => {
                            switch(oauthRequestedPermission){
                                case "oauth_clients":
                                    return (
                                        <div>- <b className="text-primary">OAuth clients (Including destructive actions)</b></div>
                                    )
                            }
                        })}
                    </p>
                    <hr/>
                <small>Authorizing will redirect to <b><a disabled>{redirectUriDomain}</a></b>.</small>
                </Card.Text>
            </Card.Body>
            </Card>
        </Container>
        <Container>
            <Row className="w-75 mx-auto">
            {signMethod === "accept" && <Col>
                <Card className="shadow-sm">
                <Card.Body>
                    <Row>
                    <Col><Button variant="warning" size="lg" className="shadow-sm text-nowrap mb-1" onClick={onDisallowAccess}>Disallow access</Button></Col>
                    <Col><Button variant="success" size="lg" className="shadow-sm text-nowrap" onClick={onAllowAccess}>Allow access</Button> </Col>
                    </Row>
                </Card.Body>
                {user !== undefined && 
                    <Card.Footer>
                    <div>Signed in as <b>{user["username"]}</b></div>
                    <Link href="/logout"><Button size="sm" variant="warning" className="shadow-sm text-nowrap mb-1">Logout?</Button></Link>
                    </Card.Footer>}
                </Card>
            </Col>}
            {signMethod === "signin" && <Col>
                <Card className="shadow-sm">
                <Card.Body>
                    <Card.Title as="h2">Sign in.</Card.Title>
                    <Card.Text>
                    <span className="mb-3 mt-3">Already have account? Just sign-in using your credentials.</span>
                    </Card.Text>

                    <InputGroup className="mb-2 shadow-sm">
                    <FormControl placeholder="Username or email" aria-label="Username or email" type="text" value={signFormLogin} onChange={(e) => {setSignFormLogin(e.target.value)}}/>
                    </InputGroup>
                    <InputGroup className="mb-4 shadow-sm">
                    <FormControl placeholder="Password" aria-label="Password" type="password" value={signFormPassword} onChange={(e) => {setSignFormPassword(e.target.value)}}/>
                    </InputGroup>
                    
                    {signFormError && (<p className="text-danger">{signFormError}</p>)}
                    <Row>
                    <Col><Button variant="warning" className="shadow-sm text-nowrap mb-1" disabled>Forgot password?</Button></Col>
                    <Col><Button variant="secondary" className="shadow-sm text-nowrap mb-1" onClick={() => setSignMethod("signup")}>No account yet?</Button></Col>
                    <Col><Button variant="primary" className="shadow-sm text-nowrap" onClick={onSignin}>Sign in!</Button> </Col>
                    </Row>
                </Card.Body>
                </Card>
            </Col>}
            {signMethod === "signup" && <Col>
                <Card className="shadow-sm">
                <Card.Body>
                    <Card.Title as="h2">Sign up.</Card.Title>
                    <Card.Text>
                    <span className="mb-3 mt-3">No account yet? Just create new!</span>
                    </Card.Text>

                    <InputGroup className="mb-2 shadow-sm">
                    <FormControl placeholder="Username" aria-label="Username" type="text" value={signFormUsername} onChange={(e) => {setSignFormUsername(e.target.value)}}/>
                    </InputGroup>
                    <InputGroup className="mb-2 shadow-sm">
                    <FormControl placeholder="Email" aria-label="Email" type="email" value={signFormEmail} onChange={(e) => {setSignFormEmail(e.target.value)}}/>
                    </InputGroup>
                    <InputGroup className="mb-4 shadow-sm">
                    <FormControl placeholder="Password" aria-label="Password" type="password" value={signFormPassword} onChange={(e) => {setSignFormPassword(e.target.value)}}/>
                    <FormControl placeholder="Password confirmation" aria-label="Password confirmation" type="password" value={signFormPasswordConfirmation} onChange={(e) => {setSignFormPasswordConfirmation(e.target.value)}}/>
                    </InputGroup>
                    
                    {signFormError && (<p className="text-danger">{signFormError}</p>)}
                    <Row>
                    <Col><Button variant="primary" className="shadow-sm text-nowrap mb-1" onClick={onSignup}>Sign up!</Button></Col>
                    <Col><Button variant="secondary" className="shadow-sm text-nowrap" onClick={() => setSignMethod("signin")}>Already have account?</Button></Col>
                    </Row>

                </Card.Body>
                </Card>
            </Col>}
            </Row>
        </Container>
    </div>);
}