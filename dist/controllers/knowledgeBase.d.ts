import { Request, Response } from 'express';
export declare class KnowledgeBaseController {
    createKnowledgeBase(req: Request, res: Response): Promise<void>;
    getKnowledgeBase(req: Request, res: Response): Promise<void>;
    deleteKnowledgeBase(req: Request, res: Response): Promise<void>;
    listKnowledgeBases(req: Request, res: Response): Promise<void>;
}
export declare const knowledgeBaseController: KnowledgeBaseController;
//# sourceMappingURL=knowledgeBase.d.ts.map