export interface GoldenStandard {
    id: string;
    questionId: string;
    question: string;
    referenceSource: string;
    standardDefinition: string;
    technicalMechanism: {
        basicPrinciple: string;
        deepPrinciple: string;
    };
    keyTerminology: string[];
    commonMisconceptions: string;
    practicalApplication: string;
    filteredSources: string[];
    validationStatus: 'PASS' | 'FAIL' | 'PENDING';
    createdAt: Date;
}
export interface ValidationResult {
    status: 'PASS' | 'FAIL';
    riskScore: number;
    validationDetails: {
        isSourceAuthoritative: boolean;
        isFactuallyCorrect: boolean;
        hasHallucination: boolean;
    };
    filteredSources: string[];
    reviewComment: string;
}
export interface GradingResult {
    id: string;
    questionId: string;
    answer: string;
    totalScore: number;
    scores: {
        accuracy: number;
        logic: number;
        completeness: number;
        depth: number;
        application: number;
    };
    evaluationReason: string;
    feedback: string;
    createdAt: Date;
}
export interface GradingFunctionArgs {
    accuracy_level: 'PERFECT' | 'MINOR_ERROR' | 'WRONG';
    accuracy_reason: string;
    logic_level: 'CLEAR' | 'WEAK' | 'NONE';
    logic_reason: string;
    depth_level: 'DEEP' | 'BASIC_ONLY' | 'NONE';
    depth_reason: string;
    is_complete_sentence: boolean;
    has_application: boolean;
    mentoring_feedback: string;
}
