export const games = [
  {
    id: "eternal-return",
    name: "이터널 리턴",
    shortName: "ER",
    description: "서비스 중",
    sections: [
      {
        id: "statistics",
        label: "통계",
        path: "/eternal-return/statistics",
        status: "운영 중",
        summary: "버전과 티어 기준의 캐릭터 통계를 확인합니다.",
      },
      {
        id: "user-report",
        label: "유저 리포트",
        path: "/eternal-return/user-report",
        status: "운영 중",
        summary: "플레이어 검색과 리포트 결과를 확인합니다.",
      },
    ],
  },
];

export function findGame(gameId) {
  return games.find((game) => game.id === gameId) ?? null;
}
