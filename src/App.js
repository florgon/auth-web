// Libraries.
import React, { useState, useEffect, useCallback } from 'react';
import { useCookies } from 'react-cookie';
import { Container, Row, Col, Card, InputGroup, FormControl, Button} from 'react-bootstrap';

// Auth API.
import { 
  authMethodVerify, authMethodSignin, authMethodSignup,
  authApiRequest,
  authApiErrorCode, authApiGetErrorMessageFromCode 
} from '@kirillzhosul/florgon-auth-api';


// Where to redirect when redirect param is not passed.
const AUTH_DEFAULT_REDIRECT_URI = "https://profile.florgon.space";
const AUTH_DEFAULT_RESPONSE_TYPE = "token";
const AUTH_DEFAULT_CLIENT_ID = "1";

const Footer = function(){
  /// @description Footer component for servic list.
  return (<div className="mt-3 w-50 mx-auto">
    <div>
      Copyright (c) 2022 <a href="https://florgon.space">Florgon</a>.
    </div>
    <a href="https://dev.florgon.space" className="mx-1">For developers</a>
    <a href="mailto: support@florgon.space" className="mx-1">Contact support</a>
  </div>);
}

function Authentication(){
  /// @description Authentication component with API requests.

  // Usings.
  const [cookies, setCookie] = useCookies(["access_token"])

  // States.
  const [error, setError] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [signMethod, setSignMethod] = useState("signup");
  const [signFormError, setSignFormError] = useState(undefined);
  const [signFormLogin, setSignFormLogin] = useState("");
  const [signFormUsername, setSignFormUsername] = useState("");
  const [signFormEmail, setSignFormEmail] = useState("");
  const [signFormPassword, setSignFormPassword] = useState("");
  const [signFormPasswordConfirmation, setSignFormPasswordConfirmation] = useState("");
  const [signFormRememberMe, setSignFormRememberMe] = useState(true); // Can`t be false due to current SSO on florgon.space
  const [oauthClientData] = useState(() => {
    const params = new URLSearchParams(document.location.search);
    return {
      redirectUri: params.get("redirect_uri") || AUTH_DEFAULT_REDIRECT_URI,
      responseType: params.get("response_type") || AUTH_DEFAULT_RESPONSE_TYPE,
      clientId: params.get("client_id") || AUTH_DEFAULT_CLIENT_ID,
      displayName: undefined,
      displayAvatar: undefined,
    }
  })

  const redirect = useCallback((token) =>{
    let redirectUriParams = "?"
    if (oauthClientData.responseType === "token"){
      if (token){
        redirectUriParams += `token=${token}`
      }else{
        redirectUriParams += `#error=user-rejected-access`
      }
      
    }
    if (oauthClientData.responseType === "code"){
      redirectUriParams += `#error=oauth-code-flow-not-implemented`
    }
    window.location.href = oauthClientData.redirectUri + redirectUriParams;
  }, [oauthClientData]);

  const applyAccessToken = useCallback((accessToken) =>{
    setCookie("access_token", accessToken, {
      "domain": ".florgon.space",
      "path": "/",
      "maxAge": 3600 * 24 * 30
    });
  }, [setCookie]);

  const onSignin = useCallback(() => {
    if (signFormLogin === ""){
      setSignFormError("Please enter username or email!");
      return;
    }
    if (signFormPassword === ""){
      setSignFormError("Please enter password!");
      return;
    }
    if (signFormPassword.length <= 5){
      setSignFormError("Password too short!");
      return;
    }

    setSignFormError(undefined);
    setIsLoading(true);
    authMethodSignin(signFormLogin, signFormPassword, (_, response) => {
      const token = response["success"]["token"];
      if (signFormRememberMe){
        applyAccessToken(token);
      }
      redirect(token);
    }, (_, error) => {
      setIsLoading(false);
      if (error && "error" in error){
        const error_code = error["error"]["code"];
        if (error_code === authApiErrorCode.AUTH_INVALID_CREDENTIALS){
          setSignFormError("Invalid credentials to authenticate!");
          return;
        }
        setSignFormError("Failed to sign-in because of error: " + authApiGetErrorMessageFromCode(error_code));
        return;
      }
      setSignFormError("Failed to sign-in because of unexpected error!");
    })
  }, [applyAccessToken, setSignFormError, setIsLoading, signFormLogin, signFormPassword]);

  const onSignup = useCallback(() => {
    if (signFormUsername === "") return setSignFormError("Please enter username!");
    if (signFormPassword === "") return setSignFormError("Please enter password!");
    if (signFormEmail === "") return setSignFormError("Please enter email!");
    if (signFormPassword.length <= 5) return setSignFormError("Password too short!");
    if (signFormUsername.length <= 4) return setSignFormError("Username too short!");
    if (signFormPassword !== signFormPasswordConfirmation) return setSignFormError("Passwords not same!");

    setSignFormError(undefined);
    setIsLoading(true);
    
    authMethodSignup(signFormUsername, signFormEmail, signFormPassword, (_, response) => {
      const token = response["success"]["token"]
      applyAccessToken(token);
      redirect(token);
    }, (_, error) => {
      setIsLoading(false);
      if (error && "error" in error){
        const error_code = error["error"]["code"];
        if (error_code === authApiErrorCode.AUTH_EMAIL_TAKEN){
          return setSignFormError("Given email is already taken!");
        }
        if (error_code === authApiErrorCode.AUTH_USERNAME_TAKEN){
          return setSignFormError("Given username is already taken!");
        }
        if (error_code === authApiErrorCode.AUTH_USERNAME_INVALID){
          return setSignFormError("Invalid username (Should be lowercase alphabet letters only)!");
        }
        if (error_code === authApiErrorCode.AUTH_EMAIL_INVALID){
          return setSignFormError("Invalid email!");
        }
        return setSignFormError("Failed to sign-in because of error: " + authApiGetErrorMessageFromCode(error_code));
      }
      setSignFormError("Failed to sign-in because of unexpected error!");
    })
  }, [applyAccessToken, setSignFormError, setIsLoading, signFormPassword, signFormPasswordConfirmation, signFormUsername, signFormEmail]);

  /// Requesting OAuth client and user.
  useEffect(() => {
    setIsLoading(true);
    authApiRequest("oauth/client/get", `client_id=${oauthClientData.clientId}`, "", (_, response) => {
      oauthClientData.displayAvatar = response["success"]["oauth_client"]["display"]["avatar"];
      oauthClientData.displayName = response["success"]["oauth_client"]["display"]["name"];
      setIsLoading(false);
      requestUser();
    }, (_, error) => {
      setIsLoading(false);
      if (oauthClientData.clientId !== AUTH_DEFAULT_CLIENT_ID){
        setError(error["error"]);
      }else{
        requestUser();
      }
    })
  }, [setIsLoading, setError, cookies]);

  /// Requesting user.
  const requestUser = useCallback(() => {
    const access_token = cookies["access_token"];
    setIsLoading(true);
    authMethodVerify(access_token, () => {
      setIsLoading(false);
      setSignMethod("accept");
    }, (_, error) => {
      setIsLoading(false);
      if ("error" in error){
        // Get error code.
        const error_code = error["error"]["code"];
        if (error_code === authApiErrorCode.AUTH_INVALID_TOKEN || error_code === authApiErrorCode.AUTH_EXPIRED_TOKEN || error_code === authApiErrorCode.AUTH_REQUIRED){
          // If our token is invalid.
          return;
        }

        setError(error["error"]);
      }
    })
  }, [setIsLoading, setError, cookies]);


  // Handle error message.
  if (error) return (<div>
    Got error. 
    Code: ({error["code"]}) {authApiGetErrorMessageFromCode(error["code"])}. Message: {error["message"]}
  </div>);

  /// Other messages.
  if (isLoading) return <div>Loading...</div>;
  
  const redirect_uri_domain = new URL(oauthClientData.redirectUri).hostname
  return (<div>
    <Container>
      <Card border="warning" className="mb-5 shadow-sm mx-auto">
        <Card.Body>
          <Card.Title as="h2">
            {oauthClientData.displayAvatar && <div><img src={oauthClientData.displayAvatar}/></div>}
            {oauthClientData.displayName && <b>{oauthClientData.displayName}&nbsp;</b>}
            {!oauthClientData.displayName && <a href={oauthClientData.redirectUri}>{redirect_uri_domain}</a>}
            requests access to your Florgon account
            </Card.Title>
          <Card.Text>
            <div><b>Note! <i>Application will have full access to your account!</i></b></div>
            
            You will be redirected to <a href={oauthClientData.redirectUri}>{oauthClientData.redirectUri}</a>.
          </Card.Text>
        </Card.Body>
      </Card>
    </Container>
    <Container>

      <Row className="w-75 mx-auto">
        {signMethod === "accept" && <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title as="h2">Allow access.</Card.Title>
              <Row>
                <Col><Button variant="warning" className="shadow-sm text-nowrap mb-1" onClick={() => redirect()}>Disallow access</Button></Col>
                <Col><Button variant="success" className="shadow-sm text-nowrap" onClick={() => redirect(cookies["access_token"])}>Allow access</Button> </Col>
              </Row>
            </Card.Body>
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

function App() {
  // Core application.
  return (
    <div className="App">
      <Container>
          <div className="text-center mt-5">
            <Authentication/>
            <Footer/>
          </div>
      </Container>
    </div>
  );
}

export default App;
