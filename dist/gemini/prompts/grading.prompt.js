"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRADING_FUNCTION = exports.GRADING_PROMPT = void 0;
const vertexai_1 = require("@google-cloud/vertexai");
exports.GRADING_PROMPT = `# Role
당신은 냉철한 AI 채점관입니다.
사용자의 답변을 [Golden Standard]와 비교하여 submit_junior_grading 도구를 호출하십시오.

# Grading Guidelines (Junior Focus)
1. Accuracy (정확성): 핵심 용어를 잘못 쓰면 가차 없이 MINOR_ERROR나 WRONG을 주십시오. 기본기가 가장 중요합니다.
2. Logic (논리): 답이 조금 틀렸어도, 나름의 이유를 설명하려 노력했다면 WEAK를 주십시오. 무논리일 때만 NONE입니다.
3. Depth (깊이)
   - BASIC_ONLY: "A는 B입니다" 처럼 정의(Definition)만 말한 경우.
   - DEEP: 정의를 넘어 "어떻게(How)" 작동하는지, 또는 "왜(Why)" 그런지 설명이 포함된 경우. (내부 구현까지 완벽하지 않아도 시도했으면 인정)
4. Feedback: "틀렸습니다"보다는 "이 부분을 보강하면 좋습니다"와 같이 멘토링 톤으로 작성하십시오.

# Constraint
- 점수(숫자)를 직접 텍스트로 말하지 마십시오. 오직 도구(함수)만 호출하십시오.

# Input Data
- 질문: {{question}}
- 사용자 답변: {{answer}}
- 모범 답안 (Golden Standard): {{golden_standard}}

반드시 submit_junior_grading 함수를 호출하여 채점 결과를 제출하십시오.`;
exports.GRADING_FUNCTION = {
    name: 'submit_junior_grading',
    description: '주니어 개발자의 면접 답변을 평가하고 채점 결과를 제출합니다. 점수는 직접 계산하지 않고 등급(Enum)으로 전달합니다.',
    parameters: {
        type: vertexai_1.SchemaType.OBJECT,
        properties: {
            accuracy_level: {
                type: vertexai_1.SchemaType.STRING,
                description: '[중요] 개념 정확성 (30점 비중). 주니어 평가의 핵심이므로 엄격히 판단.',
                enum: ['PERFECT', 'MINOR_ERROR', 'WRONG'],
            },
            accuracy_reason: {
                type: vertexai_1.SchemaType.STRING,
                description: '정확성 평가 상세 사유',
            },
            logic_level: {
                type: vertexai_1.SchemaType.STRING,
                description: '[중요] 논리적 근거 (20점 비중). 답이 틀려도 논리가 좋으면 점수 부여.',
                enum: ['CLEAR', 'WEAK', 'NONE'],
            },
            logic_reason: {
                type: vertexai_1.SchemaType.STRING,
                description: '논리 평가 상세 사유',
            },
            depth_level: {
                type: vertexai_1.SchemaType.STRING,
                description: "판단 기준: 사용자 답변에 '작동 원리(Mechanism)'나 '이유(Why)'에 대한 설명이 한 줄이라도 포함되면 DEEP, 단순히 '정의(Definition)'만 나열했으면 BASIC_ONLY 선택.",
                enum: ['DEEP', 'BASIC_ONLY', 'NONE'],
            },
            depth_reason: {
                type: vertexai_1.SchemaType.STRING,
                description: '깊이 평가 상세 사유',
            },
            is_complete_sentence: {
                type: vertexai_1.SchemaType.BOOLEAN,
                description: '문장 완결성 (10점). 가산점 영역.',
            },
            has_application: {
                type: vertexai_1.SchemaType.BOOLEAN,
                description: '실무 활용 사례 (20점). 주니어에게는 보너스 점수 영역이므로 없어도 관대하게 판단.',
            },
            mentoring_feedback: {
                type: vertexai_1.SchemaType.STRING,
                description: '주니어 개발자의 성장을 위한 구체적인 학습 가이드 및 격려',
            },
        },
        required: [
            'accuracy_level',
            'accuracy_reason',
            'logic_level',
            'logic_reason',
            'depth_level',
            'depth_reason',
            'is_complete_sentence',
            'has_application',
            'mentoring_feedback',
        ],
    },
};
//# sourceMappingURL=grading.prompt.js.map