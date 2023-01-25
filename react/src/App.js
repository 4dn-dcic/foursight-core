import { Navigate, BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AccountsPage from './pages/AccountsPage';
import AwsS3Page from './pages/aws/AwsS3Page';
import ChecksPage from './pages/ChecksPage';
import CheckHistoryPage from './pages/CheckHistoryPage';
import Env from './utils/Env';
import EnvPage from './pages/EnvPage';
import Footer from './Footer';
import ForbiddenPage from './pages/ForbiddenPage';
import Header from './Header';
import HeaderProvider from './hooks/HeaderProvider';
import HomePage from './pages/HomePage';
import InfoPage from './pages/InfoPage';
import LoginCognitoCallback from './pages/LoginCognitoCallback';
import LoginPage from './pages/LoginPage';
import GacComparePage from './pages/GacComparePage';
import InfrastructurePage from './pages/aws/InfrastructurePage';
import NotFoundPage from './pages/NotFoundPage';
import Page from './Page';
import RedirectPage from './pages/RedirectPage';
import UserPage from './pages/UserPage';
import UserCreatePage from './pages/UserCreatePage';
import UserEditPage from './pages/UserEditPage';
import UsersPage from './pages/UsersPage';
import useHeader from './hooks/Header';

const App = () => {

    const header = useHeader();

    function getDefaultPath() {
        return `/api/react/${Env.PreferredName(Env.Default(header))}/login`;
    }

    return <Router>
        <HeaderProvider>
            <Header />
            <div style={{margin:"14pt"}}>
                <Routes>
                    <Route path="/api/react/cognito/callback" element={
                        <LoginCognitoCallback />
                    }/>
                    <Route path="/" element={
                        <Navigate to={getDefaultPath()} />
                    } />
                    <Route path="/api" element={
                        <Navigate to={getDefaultPath()} />
                    } />
                    <Route path="/api/react" element={
                        <Navigate to={getDefaultPath()} />
                    } />
                    <Route path="/api/react/:environ" element={
                        <Navigate to={getDefaultPath()} />
                    } />
                    <Route path="/api/react/:environ/accounts" element={
                        <Page.AuthorizationRequired>
                            <AccountsPage />
                        </Page.AuthorizationRequired>
                    } />
                    <Route path="/api/react/:environ/env" element={
                        <Page.KnownEnvRequired>
                            <EnvPage />
                        </Page.KnownEnvRequired>
                    } />
                    <Route path="/api/react/env" element={
                        <Page.KnownEnvRequired>
                            <EnvPage />
                        </Page.KnownEnvRequired>
                    } />
                    <Route path="/api/react/:environ/login" element={
                        <Page.KnownEnvRequired>
                            <LoginPage />
                        </Page.KnownEnvRequired>
                    } />
                    <Route path="/api/react/:environ/checks" element={
                        <Page.AuthorizationRequired>
                            <ChecksPage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/checks/:check/history" element={
                        <Page.AuthorizationRequired>
                            <CheckHistoryPage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/home" element={
                        <Page.AuthorizationRequired>
                            <HomePage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/info" element={
                        <Page.AuthorizationRequired>
                            <InfoPage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/users" element={
                        <Page.AuthorizationRequired>
                            <UsersPage />
                        </Page.AuthorizationRequired>
                    } />
                    <Route path="/api/react/:environ/users/:email" element={
                        <Page.AuthorizationRequired>
                            <UserPage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/users/edit/:uuid" element={
                        <Page.AuthorizationRequired>
                            <UserEditPage />
                        </Page.AuthorizationRequired>
                    } />
                    <Route path="/api/react/:environ/users/create" element={
                        <Page.AuthorizationRequired>
                            <UserCreatePage />
                        </Page.AuthorizationRequired>
                    } />
                    <Route path="/api/react/:environ/gac/:environCompare" element={
                        <Page.AuthorizationRequired>
                            <GacComparePage />
                        </Page.AuthorizationRequired>
                    }>
                    </Route>
                    <Route path="/api/react/:environ/aws/s3" element={
                        <Page.AuthorizationRequired>
                            <AwsS3Page />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/aws/infrastructure" element={
                        <Page.AuthorizationRequired>
                            <InfrastructurePage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/forbidden" element={
                        <ForbiddenPage />
                    }/>
                    <Route path="/redirect" element={
                        <RedirectPage />
                    }/>
                    <Route path="*" element={
                        <Page.AuthorizationRequired>
                            <NotFoundPage />
                        </Page.AuthorizationRequired>
                    }/>
                </Routes>
            </div>
            <Footer />
         </HeaderProvider>
    </Router>
};

export default App;
