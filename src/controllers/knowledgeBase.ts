import { Request, Response } from 'express';
import { knowledgeBaseService, KnowledgeBaseInput } from '../services/knowledgeBase';

export class KnowledgeBaseController {
  async createKnowledgeBase(req: Request, res: Response): Promise<void> {
    try {
      if (!req.body) {
        res.status(400).json({
          success: false,
          message: 'Please provide data.'
        });
        return;
      }

      console.log(req.body)
      const { text, link } = req.body;
      const file = req.file;

      const input: KnowledgeBaseInput = {
        text,
        file,
        link
      };
      const result = await knowledgeBaseService.processKnowledgeBase(input);

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
    } catch (error) {
      console.error('Error in createKnowledgeBase:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  //   Will see if needed NOT USED FOR NOW
  async getKnowledgeBase(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Token is required'
        });
        return;
      }

      const data = await knowledgeBaseService.getKnowledgeBase(token);

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
    } catch (error) {
      console.error('Error in getKnowledgeBase:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

//   Will see if needed NOT USED FOR NOW
  async deleteKnowledgeBase(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Token is required'
        });
        return;
      }

      const deleted = await knowledgeBaseService.deleteKnowledgeBase(token);

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
    } catch (error) {
      console.error('Error in deleteKnowledgeBase:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  //   Will see if needed NOT USED FOR NOW
  async listKnowledgeBases(req: Request, res: Response): Promise<void> {
    try {
      const tokens = await knowledgeBaseService.listKnowledgeBases();

      res.status(200).json({
        success: true,
        data: {
          tokens,
          count: tokens.length
        }
      });
    } catch (error) {
      console.error('Error in listKnowledgeBases:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export const knowledgeBaseController = new KnowledgeBaseController();