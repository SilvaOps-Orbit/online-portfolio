import { Component, type ErrorInfo, type PropsWithChildren } from "react";

interface IslandBoundaryProps extends PropsWithChildren {
  label: string;
}

interface IslandBoundaryState {
  failed: boolean;
}

export class IslandBoundary extends Component<IslandBoundaryProps, IslandBoundaryState> {
  state: IslandBoundaryState = { failed: false };

  static getDerivedStateFromError(): IslandBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.label} React island failed safely`, error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="react-api-status-fallback is-error" role="status">
          {this.props.label} is temporarily unavailable. The rest of the portfolio is still working.
        </div>
      );
    }
    return this.props.children;
  }
}
