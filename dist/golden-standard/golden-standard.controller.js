"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoldenStandardController = void 0;
const common_1 = require("@nestjs/common");
const golden_standard_service_1 = require("./golden-standard.service");
const dto_1 = require("./dto");
let GoldenStandardController = class GoldenStandardController {
    goldenStandardService;
    constructor(goldenStandardService) {
        this.goldenStandardService = goldenStandardService;
    }
    async generate(dto) {
        return this.goldenStandardService.generate(dto.question);
    }
    findAll() {
        return this.goldenStandardService.findAll();
    }
    findById(id) {
        return this.goldenStandardService.findById(id);
    }
    findByQuestionId(questionId) {
        return this.goldenStandardService.findByQuestionId(questionId);
    }
};
exports.GoldenStandardController = GoldenStandardController;
__decorate([
    (0, common_1.Post)('generate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateGoldenStandardDto]),
    __metadata("design:returntype", Promise)
], GoldenStandardController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], GoldenStandardController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], GoldenStandardController.prototype, "findById", null);
__decorate([
    (0, common_1.Get)('question/:questionId'),
    __param(0, (0, common_1.Param)('questionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], GoldenStandardController.prototype, "findByQuestionId", null);
exports.GoldenStandardController = GoldenStandardController = __decorate([
    (0, common_1.Controller)('golden-standard'),
    __metadata("design:paramtypes", [golden_standard_service_1.GoldenStandardService])
], GoldenStandardController);
//# sourceMappingURL=golden-standard.controller.js.map