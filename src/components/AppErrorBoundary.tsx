import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { failed: boolean };

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Application render failed", { error, componentStack: info.componentStack });
  }

  render(): ReactNode {
    if (this.state.failed) {
      return <main className="center-screen"><section className="state-panel"><h1>Aplikasi tidak dapat ditampilkan</h1><p>Muat ulang halaman. Jika masalah berlanjut, hubungi pengelola laboratorium.</p><button className="button primary" type="button" onClick={() => window.location.reload()}>Muat ulang</button></section></main>;
    }
    return this.props.children;
  }
}
