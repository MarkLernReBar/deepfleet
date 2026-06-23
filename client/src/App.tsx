import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Shell } from "./components/Shell";
import Overview from "./pages/Overview";
import Fleets from "./pages/Fleets";
import Agents from "./pages/Agents";
import AgentBuilder from "./pages/AgentBuilder";
import AgentDetail from "./pages/AgentDetail";
import Runs from "./pages/Runs";
import RunTrace from "./pages/RunTrace";
import Inbox from "./pages/Inbox";
import Tools from "./pages/Tools";
import Skills from "./pages/Skills";
import Credentials from "./pages/Credentials";
import Chat from "./pages/Chat";

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/chat" component={Chat} />
        <Route path="/fleets" component={Fleets} />
        <Route path="/agents" component={Agents} />
        <Route path="/agents/new" component={AgentBuilder} />
        <Route path="/agents/:id/edit" component={AgentBuilder} />
        <Route path="/agents/:id" component={AgentDetail} />
        <Route path="/runs" component={Runs} />
        <Route path="/runs/:id" component={RunTrace} />
        <Route path="/inbox" component={Inbox} />
        <Route path="/tools" component={Tools} />
        <Route path="/skills" component={Skills} />
        <Route path="/credentials" component={Credentials} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
