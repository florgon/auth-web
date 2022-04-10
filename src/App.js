// Libraries.
import React, { useState, useEffect, useCallback } from 'react';
import { useCookies } from 'react-cookie';
import { Container, Row, Col} from 'react-bootstrap';

// Auth API.
import { authMethodUser, authApiErrorCode, authApiGetErrorMessageFromCode } from './florgon-auth-api';


// Where to redirect when redirect param is not passed.
const AUTH_DEFAULT_REDIRECT_URL = "https://profile.florgon.space/?";


function Authentication(){
  /// @description Authentication component with API requests.

  // Usings.
  const [cookies, setCookie] = useCookies(["access_token"])

  // States.
  const [error, setError] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);

  /// Requesting user.
  useEffect(() => {
    authMethodUser(cookies["access_token"], (_, response) => {
      window.location.href = AUTH_DEFAULT_REDIRECT_URL;
    }, (_, error) => {
      setIsLoading(false);
      if ("error" in error){
        // Get error code.
        const error_code = error["error"]["code"];
        if (error_code == authApiErrorCode.AUTH_INVALID_TOKEN || error_code == authApiErrorCode.AUTH_EXPIRED_TOKEN || error_code == authApiErrorCode.AUTH_REQUIRED){
          // If our token is invalid.
          return;
        }

        setError(error["error"]);
      }
    })
  }, [setIsLoading, setError]);


  // Handle error message.
  if (error) return (<div>
    Got error when loading account. 
    Code: ({error["code"]}) {authApiGetErrorMessageFromCode(error["code"])}. Message: {error["message"]}
  </div>);

  /// Other messages.
  if (isLoading) return <div>Loading account information...</div>;
  
  return (<div>Auth</div>);
}

function App() {
  // Core application.
  return (
    <div className="App">
      <Container fluid>
        <Row>
          <Col className="d-flex justify-content-center">
            <div className="text-center mt-5">
              <Authentication/>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;
