import type { ReactNode } from "react";
import type { LoadState } from "../types";
import { LoadingIndicator } from "./LoadingIndicator";

type Props<T> = {
  state: LoadState<T[]>;
  emptyTitle: string;
  emptyText: string;
  onRetry: () => void;
  children: (data: T[]) => ReactNode;
};

export function DataState<T>({ state, emptyTitle, emptyText, onRetry, children }: Props<T>) {
  if (state.status === "loading") return <div className="state-panel loading-panel"><LoadingIndicator /></div>;
  if (state.status === "error") {
    return <div className="state-panel state-error" role="alert"><p>{state.message}</p><button type="button" className="button secondary" onClick={onRetry}>Coba muat lagi</button></div>;
  }
  if (state.data.length === 0) return <div className="state-panel"><h2>{emptyTitle}</h2><p>{emptyText}</p></div>;
  return <>{children(state.data)}</>;
}
