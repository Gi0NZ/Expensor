import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

const reactPlugin = new ReactPlugin();
const connString = process.env.REACT_APP_INSIGHT_CONNECTION_STRING
const appInsights = new ApplicationInsights({
    config: {
        connectionString: connString,
        extensions: [reactPlugin],
        enableAutoRouteTracking: true, 
        enableCorsCorrelation: true,   
});

appInsights.loadAppInsights();

export { reactPlugin, appInsights };