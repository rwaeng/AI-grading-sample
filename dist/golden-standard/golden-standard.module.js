"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoldenStandardModule = void 0;
const common_1 = require("@nestjs/common");
const golden_standard_controller_1 = require("./golden-standard.controller");
const golden_standard_service_1 = require("./golden-standard.service");
const validation_module_1 = require("../validation/validation.module");
let GoldenStandardModule = class GoldenStandardModule {
};
exports.GoldenStandardModule = GoldenStandardModule;
exports.GoldenStandardModule = GoldenStandardModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => validation_module_1.ValidationModule)],
        controllers: [golden_standard_controller_1.GoldenStandardController],
        providers: [golden_standard_service_1.GoldenStandardService],
        exports: [golden_standard_service_1.GoldenStandardService],
    })
], GoldenStandardModule);
//# sourceMappingURL=golden-standard.module.js.map