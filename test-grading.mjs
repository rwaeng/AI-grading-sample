/* test-grading.mjs */
const BASE_URL = 'http://localhost:3000';

// ⚠️ 중요: test-golden.mjs를 실행해서 나온 ID를 여기에 새로 복사해 넣으세요!
const QUESTION_ID = '9a1eb715-82bd-4b42-aec5-1ce7d6e85f0d'; 

async function grade(answer) {
  const response = await fetch(`${BASE_URL}/grading`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId: QUESTION_ID, answer }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`서버 에러 [${response.status}]: ${errorBody.message || JSON.stringify(errorBody)}`);
  }

  return response.json();
}

async function runTest() {
  const answer = '프로세스는 OS로부터 독립된 메모리를 할당받고, 스레드는 프로세스 내의 Code, Data, Heap, stack 영역을 공유합니다.';
  
  console.log(`\n==================================================`);
  console.log(`⚖️ [2/2] AI 채점 및 상세 피드백 테스트`);
  console.log(`제출 답안: "${answer}"`);
  console.log(`==================================================\n`);

  try {
    const start = Date.now();
    const result = await grade(answer);
    console.log(`⏱️  소요 시간: ${Date.now() - start}ms\n`);

    console.log(`--- [채점 결과 (Score Breakdown)] ---`);
    console.log(`🏆 총점: ${result.totalScore} / 100`);
    console.log(`└ 정확성: ${result.scores.accuracy}점`);
    console.log(`└ 논리성: ${result.scores.logic}점`);
    console.log(`└ 깊이감: ${result.scores.depth}점`);
    console.log(`└ 완결성: ${result.scores.completeness}점`);
    console.log(`└ 실무활용: ${result.scores.application}점`);

    console.log(`\n--- [상세 평가 사유 (Evaluation Reason)] ---`);
    console.log(result.evaluationReason);

    console.log(`\n--- [멘토링 피드백 (Mentoring Feedback)] ---`);
    console.log(result.feedback);

    if (result.similarity) {
      console.log(`\n--- [유사도 정보 (Similarity)] ---`);
      console.log(`📍 계산된 유사도: ${(result.similarity * 100).toFixed(2)}%`);
    }

    console.log(`\n==================================================\n`);

  } catch (error) {
    console.error(`❌ 테스트 실패: ${error.message}`);
    if (error.message.includes('404')) {
      console.log('💡 TIP: 서버를 재시작했다면 test-golden.mjs를 먼저 실행해서 새로운 ID를 만드세요!');
    }
  }
}

runTest();