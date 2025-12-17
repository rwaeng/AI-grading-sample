// Simple test script for the API
const BASE_URL = 'http://localhost:3000';

async function testGoldenStandardGeneration() {
  console.log('🔄 Testing Golden Standard Generation...\n');
  
  const response = await fetch(`${BASE_URL}/golden-standard/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: '프로세스와 스레드의 차이점은?',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Error:', response.status, errorText);
    return null;
  }

  const result = await response.json();
  console.log('✅ Golden Standard Generated!\n');
  console.log('Question ID:', result.questionId);
  console.log('Validation Status:', result.validationStatus);
  console.log('Standard Definition:', result.standardDefinition?.substring(0, 200) + '...');
  console.log('Key Terminology:', result.keyTerminology);
  console.log('\nFiltered Sources:', result.filteredSources);
  
  return result;
}

async function testGrading(questionId) {
  console.log('\n🔄 Testing Grading...\n');
  
  const response = await fetch(`${BASE_URL}/grading`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      questionId,
      answer: '프로세스는 운영체제에서 실행 중인 프로그램의 인스턴스이며, 독립적인 메모리 공간을 가집니다. 스레드는 프로세스 내에서 실행되는 흐름의 단위로, 같은 프로세스 내의 스레드들은 힙 메모리를 공유합니다.',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Error:', response.status, errorText);
    return;
  }

  const result = await response.json();
  console.log('✅ Grading Completed!\n');
  console.log('Total Score:', result.totalScore, '/ 100');
  console.log('Scores:', result.scores);
  console.log('\nFeedback:', result.feedback);
}

async function main() {
  try {
    const goldenStandard = await testGoldenStandardGeneration();
    
    if (goldenStandard) {
      await testGrading(goldenStandard.questionId);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
