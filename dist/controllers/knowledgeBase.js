"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeBaseController = exports.KnowledgeBaseController = void 0;
const knowledgeBase_1 = require("../services/knowledgeBase");
class KnowledgeBaseController {
    async createKnowledgeBase(req, res) {
        try {
            if (!req.body) {
                res.status(400).json({
                    success: false,
                    message: 'Please provide data.'
                });
                return;
            }
            const { text, link, youtubeUrl } = req.body;
            const file = req.file;
            const input = {
                text,
                file,
                link,
                youtubeUrl
            };
            const result = await knowledgeBase_1.knowledgeBaseService.processKnowledgeBase(input);
            if (!result.success) {
                const firstErrorMessage = result.errors?.[0]?.message || 'Validation failed';
                res.status(400).json({
                    success: false,
                    message: firstErrorMessage
                });
                return;
            }
            res.status(201).json({
                success: true,
                message: 'Knowledge base created successfully',
                token: result.token
            });
        }
        catch (error) {
            console.error('Error in createKnowledgeBase:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
    //   Will see if needed NOT USED FOR NOW
    async getKnowledgeBase(req, res) {
        try {
            const { token } = req.params;
            if (!token) {
                res.status(400).json({
                    success: false,
                    message: 'Token is required'
                });
                return;
            }
            const data = await knowledgeBase_1.knowledgeBaseService.getKnowledgeBase(token);
            if (data === null) {
                res.status(404).json({
                    success: false,
                    message: 'Knowledge base not found or expired'
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: {
                    token: data.token,
                    text: data.text,
                    link: data.link,
                    fileInfo: data.fileInfo,
                    linkInfo: data.linkInfo,
                    createdAt: data.createdAt,
                    expiresAt: data.expiresAt
                }
            });
        }
        catch (error) {
            console.error('Error in getKnowledgeBase:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
    //   Will see if needed NOT USED FOR NOW
    async deleteKnowledgeBase(req, res) {
        try {
            const { token } = req.params;
            if (!token) {
                res.status(400).json({
                    success: false,
                    message: 'Token is required'
                });
                return;
            }
            const deleted = await knowledgeBase_1.knowledgeBaseService.deleteKnowledgeBase(token);
            if (!deleted) {
                res.status(404).json({
                    success: false,
                    message: 'Knowledge base not found'
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: 'Knowledge base deleted successfully'
            });
        }
        catch (error) {
            console.error('Error in deleteKnowledgeBase:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
    //   Will see if needed NOT USED FOR NOW
    async listKnowledgeBases(req, res) {
        try {
            const tokens = await knowledgeBase_1.knowledgeBaseService.listKnowledgeBases();
            res.status(200).json({
                success: true,
                data: {
                    tokens,
                    count: tokens.length
                }
            });
        }
        catch (error) {
            console.error('Error in listKnowledgeBases:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}
exports.KnowledgeBaseController = KnowledgeBaseController;
exports.knowledgeBaseController = new KnowledgeBaseController();
//# sourceMappingURL=knowledgeBase.js.map