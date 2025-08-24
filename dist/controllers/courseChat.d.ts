import { Request, Response } from 'express';
export declare class CourseChatController {
    private readonly CHAT_HISTORY_TTL;
    private readonly embeddings;
    constructor();
    chat(req: Request, res: Response): Promise<void>;
}
export declare const courseChatController: CourseChatController;
//# sourceMappingURL=courseChat.d.ts.map