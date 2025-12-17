import { GoldenStandardService } from './golden-standard.service';
import { CreateGoldenStandardDto } from './dto';
import { GoldenStandard } from '../common/interfaces';
export declare class GoldenStandardController {
    private readonly goldenStandardService;
    constructor(goldenStandardService: GoldenStandardService);
    generate(dto: CreateGoldenStandardDto): Promise<GoldenStandard>;
    findAll(): GoldenStandard[];
    findById(id: string): GoldenStandard | undefined;
    findByQuestionId(questionId: string): GoldenStandard | undefined;
}
