/* test-golden.mjs */
const BASE_URL = 'http://localhost:3000';

async function testGolden() {
  const question = '프로세스와 스레드의 차이점을 메모리 구조 관점에서 설명해주세요.';
  console.log(`\n==================================================`);
  console.log(`🚀 [1/2] 모범 답안 생성 및 검증 테스트`);
  console.log(`질문: "${question}"`);
  console.log(`==================================================\n`);
  
  try {
    const start = Date.now();
    const response = await fetch(`${BASE_URL}/golden-standard/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    const result = await response.json();
    console.log(`⏱️  소요 시간: ${Date.now() - start}ms\n`);

    console.log(`--- [검증 결과 (Validation)] ---`);
    const statusIcon = result.validationStatus === 'PASS' ? '✅' : '❌';
    console.log(`${statusIcon} 상태: ${result.validationStatus}`);
    
    if (result.validationDetails) {
      console.log(`🚩 리스크 점수: ${result.validationDetails.riskScore}`);
      console.log(`✅ 출처 권위성: ${result.validationDetails.isSourceAuthoritative}`);
      console.log(`✅ 사실 정확성: ${result.validationDetails.isFactuallyCorrect}`);
      console.log(`⚠️ 환각 여부: ${result.validationDetails.hasHallucination}`);
    }
    
    if (result.reviewComment) console.log(`💬 검수관 코멘트: ${result.reviewComment}`);
    console.log(`🔗 필터링된 공식 출처: ${result.filteredSources?.length > 0 ? result.filteredSources.join(', ') : '없음'}`);
    
    console.log(`\n--- [기본 정보] ---`);
    console.log(`🆔 Question ID: ${result.questionId}`);
    console.log(`📚 참고 문헌 (Raw): ${result.referenceSource}`);
    console.log(`🔑 핵심 키워드: ${result.keyTerminology?.join(', ')}`);

    console.log(`\n--- [기술 메커니즘] ---`);
    console.log(`[Basic]: ${result.technicalMechanism?.basicPrinciple}`);
    console.log(`[Deep]: ${result.technicalMechanism?.deepPrinciple}`);

    console.log(`\n--- [오개념 및 실무] ---`);
    console.log(`⚠️ 흔한 오개념: ${result.commonMisconceptions}`);
    console.log(`💡 실무 트렌드: ${result.practicalApplication}`);

    console.log(`\n--- [표준 정의 (Standard Definition)] ---`);
    console.log(result.standardDefinition);
    console.log(`\n==================================================\n`);
    
  } catch (error) {
    console.error('❌ 시스템 에러:', error.message);
  }
}

testGolden();