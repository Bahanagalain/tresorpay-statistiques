import CountUpModule from 'react-countup';

// `react-countup` is shipped as CommonJS in this project setup.
// Depending on the bundler path, the default import can be the module object
// instead of the React component. Normalize it once here.
const CountUp = CountUpModule?.default ?? CountUpModule;

export default CountUp;
