import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 作品集專案不接錯誤回報服務，至少留下 console 記錄方便除錯。
    console.error('Unhandled error caught by ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--op-bg, #070B09)' }}>
          <div className="text-center max-w-sm">
            <p style={{ fontSize: 14, fontWeight: 700, color: '#E8A33D', marginBottom: 8 }}>發生錯誤</p>
            <p style={{ fontSize: 12, color: '#8A968E', marginBottom: 20 }}>
              這個頁面出了點問題，可能是分享連結損毀。回到首頁重試一次。
            </p>
            <button
              onClick={() => { window.location.hash = ''; window.location.reload(); }}
              style={{
                fontSize: 12, fontWeight: 700, padding: '10px 20px', borderRadius: 12,
                background: '#E8A33D', color: '#0A0600', border: 'none', cursor: 'pointer',
              }}
            >
              回到首頁
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
