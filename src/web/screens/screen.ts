// 화면 하나: 그리고, 떠날 때 정리(연결 끊기 등)
export type Cleanup = () => void;
export type Screen = (root: HTMLElement) => Cleanup | void | Promise<Cleanup | void>;

export const navigate = (hash: string) => {
  location.hash = hash;
};
