import { Component } from 'react';

class TestPage extends Component {

    constructor(props) {
        super(props);
        console.log('TestPage:');
        console.log(props)
    }

    componentWillMount() {
        console.log('componentWillMount');
    }

    render() {
        return (<>
            <span>Hello, world!</span>
        </>);
    }
}

export default TestPage;
