import express from "express";
import { z } from "zod";
import { getFirestore } from "firebase-admin/firestore";

export const api = { express, z, getFirestore };
