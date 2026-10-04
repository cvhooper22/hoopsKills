import React from 'react';

// A stored snapshot can outlive the component that renders it. If one no longer renders,
// show `fallback` for that item instead of taking the whole page down.
export default class RenderBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError () {
    return { failed: true };
  }

  componentDidCatch (err) {
    console.error('Collection item failed to render', err);
  }

  render () {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
