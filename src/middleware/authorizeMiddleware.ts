import { NextFunction, Request, Response } from "express";

function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).send("Unauthorized");
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).send("Forbidden");
      return;
    }

    next();
  };
}

export { authorize };