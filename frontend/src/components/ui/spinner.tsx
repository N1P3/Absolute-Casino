import React from 'react';

const Spinner = ({className = ''}) => (
    <div className={`w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin ${className}`}></div>
);

export default Spinner;
