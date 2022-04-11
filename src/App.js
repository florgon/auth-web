// Libraries.
import React, { useState, useEffect, useCallback } from 'react';
import { useCookies } from 'react-cookie';
import { Container, Row, Col, Card, InputGroup, FormControl, Button} from 'react-bootstrap';

// Auth API.
import { authMethodVerify, authMethodSignin, authMethodSignup, authApiErrorCode, authApiGetErrorMessageFromCode } from './florgon-auth-api';


// Where to redirect when redirect param is not passed.
const AUTH_DEFAULT_REDIRECT_URL = "https://profile.florgon.space/?";

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

  const redirect = useCallback(() =>{
    const params = new URLSearchParams(document.location.search);
    let redirect_uri = params.get("redirect_uri") || AUTH_DEFAULT_REDIRECT_URL;
    window.location.href = redirect_uri;
  }, []);

  const applyAccessToken = useCallback((accessToken) =>{
    setCookie("access_token", accessToken, {
      "domain": ".florgon.space",
      "path": "/"
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
      applyAccessToken(response["success"]["token"]);
      redirect();
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
      applyAccessToken(response["success"]["token"]);
      redirect();
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
        if (error_code === authApiErrorCode.AUTH_EMAIL_INVALID){
          return setSignFormError("Invalid email!");
        }
        return setSignFormError("Failed to sign-in because of error: " + authApiGetErrorMessageFromCode(error_code));
      }
      setSignFormError("Failed to sign-in because of unexpected error!");
    })
  }, [applyAccessToken, setSignFormError, setIsLoading, signFormPassword, signFormPasswordConfirmation, signFormUsername, signFormEmail]);

  /// Requesting user.
  useEffect(() => {
    const access_token = cookies["access_token"];
    authMethodVerify(access_token, () => {
      redirect();
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
    Got error when loading account. 
    Code: ({error["code"]}) {authApiGetErrorMessageFromCode(error["code"])}. Message: {error["message"]}
  </div>);

  /// Other messages.
  if (isLoading) return <div>Loading...</div>;
  
  return (<div>
    <Container fluid>
      <Row>
        {signMethod === "signin" && <Col>
          <Card className="shadow">
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
          <Card className="shadow">
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
      <Container fluid>
        <Row>
          <Col className="d-flex justify-content-center">
            <div className="text-center mt-5">
              <Card className="shadow-sm mb-5" border="warning">
                <Card.Body>
                  <Card.Title as="h2">Authentication.</Card.Title>
                  <Card.Text>
                    <span className="mb-3 mt-3">In order to continue, you should authenticate in your Florgon account.</span>
                  </Card.Text>
                </Card.Body>
              </Card>
              <Authentication/>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;
